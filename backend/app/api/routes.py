import math
from datetime import datetime, timezone
from typing import Optional

import ifcopenshell
import ifcopenshell.geom
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from ..core.config import (
    DEFAULT_MAX_PERMITTED_FLOORS,
    DEFAULT_MIN_COLUMN_DIM_MM,
    FIXTURES_DIR,
)
from ..models.schemas import (
    AuditLinkRequest,
    AuditResponse,
    CheckStatusValue,
    ParcelDetailResponse,
    ParcelFeatureCollection,
    ParcelSubmissionResponse,
    VersionDiff,
)
from ..services.ifc_auditor import IFCAuditor
from ..services.parcel_store import (
    get_parcel_details,
    link_audit_to_parcel,
    list_parcel_features,
    list_parcel_records,
    save_audit_result,
)

router = APIRouter()
MAX_IFC_BYTES = 50 * 1024 * 1024


async def _read_ifc_upload(file: UploadFile) -> bytes:
    filename = file.filename or ""
    if not filename.lower().endswith((".ifc", ".step")):
        raise HTTPException(status_code=400, detail=f"Unsupported file '{filename}'. Upload an IFC or STEP file.")
    file_bytes = await file.read(MAX_IFC_BYTES + 1)
    if len(file_bytes) > MAX_IFC_BYTES:
        raise HTTPException(status_code=413, detail="IFC file exceeds the 50 MiB upload limit.")
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded IFC file is empty.")
    if not file_bytes.lstrip().upper().startswith(b"ISO-10303-21;"):
        raise HTTPException(status_code=422, detail="Malformed IFC/STEP file: expected an ISO-10303-21 header.")
    return file_bytes


def _mock_parcels() -> list[dict]:
    return list_parcel_records()


def _length_unit_to_m(model: ifcopenshell.file) -> Optional[float]:
    try:
        for assignment in model.by_type("IfcUnitAssignment"):
            for unit in assignment.Units:
                if getattr(unit, "UnitType", None) != "LENGTHUNIT":
                    continue
                if unit.is_a("IfcSIUnit"):
                    prefix = getattr(unit, "Prefix", None)
                    return {"MILLI": 0.001, "CENTI": 0.01}.get(prefix, 1.0)
                if unit.is_a("IfcConversionBasedUnit"):
                    factor = unit.ConversionFactor
                    if factor and factor.ValueComponent:
                        return float(factor.ValueComponent.wrappedValue)
    except (AttributeError, TypeError, ValueError):
        return None
    return None


def _footprint_area_m2(model: ifcopenshell.file) -> Optional[float]:
    unit_to_m = _length_unit_to_m(model)
    if unit_to_m is None:
        return None
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    areas: list[float] = []
    for slab in model.by_type("IfcSlab"):
        try:
            vertices = ifcopenshell.geom.create_shape(settings, slab).geometry.verts
        except (RuntimeError, ValueError):
            continue
        coords = list(zip(vertices[0::3], vertices[1::3]))
        if not coords:
            continue
        width = max(x for x, _ in coords) - min(x for x, _ in coords)
        depth = max(y for _, y in coords) - min(y for _, y in coords)
        area = width * depth
        if math.isfinite(area) and area > 0:
            areas.append(area)
    return round(max(areas) * unit_to_m * unit_to_m, 3) if areas else None


def _height_from_storeys(storeys: list[dict]) -> Optional[float]:
    elevations = sorted(storey["elevation_mm"] for storey in storeys)
    if len(elevations) < 2:
        return None
    average_floor_height = (elevations[-1] - elevations[0]) / (len(elevations) - 1)
    return round((elevations[-1] - elevations[0] + average_floor_height) / 1000.0, 3)


@router.get("/health", tags=["System"])
def health_check():
    """Health status and ifcopenshell version check."""
    return {
        "status": "healthy",
        "service": "SiteBeta Kenya local IFC geometry review",
        "ifcopenshell_version": getattr(ifcopenshell, "__version__", "0.7.0+"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "integration": "Local rule engine; no government connection",
    }


@router.get("/parcels", response_model=ParcelFeatureCollection, tags=["Parcels"])
def parcels_geojson(bbox: Optional[str] = Query(default=None, max_length=100)):
    """Return mock parcels and latest audit properties as a WGS84 GeoJSON FeatureCollection."""
    try:
        return list_parcel_features(bbox)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/parcels/{parcel_id}", response_model=ParcelDetailResponse, tags=["Parcels"])
def parcel_detail(parcel_id: str):
    """Return one mock parcel and its linked audit history."""
    parcel = get_parcel_details(parcel_id)
    if parcel is None:
        raise HTTPException(status_code=404, detail="Parcel was not found.")
    return parcel


@router.post(
    "/parcels/{parcel_id}/link-audit",
    response_model=ParcelSubmissionResponse,
    tags=["Parcels"],
)
def link_parcel_audit(parcel_id: str, request: AuditLinkRequest):
    """Link a persisted IFC audit result to a demo parcel."""
    try:
        submission = link_audit_to_parcel(parcel_id, request.audit_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if submission is None:
        raise HTTPException(status_code=404, detail="Parcel was not found.")
    return submission


@router.post(
    "/plans/audit",
    response_model=AuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Run advisory IFC geometry checks",
    tags=["Audit"],
)
async def audit_plan(
    file: UploadFile = File(..., description="Uploaded .ifc BIM file"),
    parcel_id: str = Form(..., description="Cadastral L.R. parcel identifier"),
    county: Optional[str] = Form("Nairobi City County", description="Kenyan county"),
    zoning_zone: Optional[str] = Form("Nairobi Zone 14", description="County zoning area / district"),
    max_permitted_floors: int = Form(
        DEFAULT_MAX_PERMITTED_FLOORS,
        description="Zoning code maximum permissible storeys",
    ),
    min_column_dim_mm: Optional[float] = Form(
        DEFAULT_MIN_COLUMN_DIM_MM,
        description="Placeholder section dimension for engineer review; not a pass/fail threshold",
    ),
) -> AuditResponse:
    """
    Accept an IFC building model and return local geometry-check findings and explicit
    data-availability statuses. This endpoint does not issue official compliance decisions.
    """
    try:
        file_bytes = await _read_ifc_upload(file)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    # Mock parcel lookup (clearly labeled as mock data — not from an official registry)
    match = next((p for p in _mock_parcels() if p["id"] == parcel_id), None)
    if match is None:
        raise HTTPException(status_code=422, detail="Select a parcel from the mock parcel records; free-typed limits are not used.")
    max_permitted_floors = match["permitted_storeys"]
    county = match.get("county", county)
    zoning_zone = match.get("zone", zoning_zone)

    try:
        auditor = IFCAuditor(file_bytes)
        result = auditor.audit(
            parcel_id=parcel_id,
            max_permitted_floors=max_permitted_floors,
            min_column_dim_mm=min_column_dim_mm or DEFAULT_MIN_COLUMN_DIM_MM,
        )
        result.county = county
        result.zoning_zone = zoning_zone
        result.audit_id = save_audit_result(result)
        return result
    except Exception as exc:
        if isinstance(exc, ifcopenshell.Error):
            detail = "Malformed or incomplete IFC model: the IFC parser could not read this file."
        else:
            detail = f"Failed to parse or audit IFC model: {str(exc)}"
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )


@router.post("/plans/compare", response_model=VersionDiff, tags=["Audit"])
async def compare_plans(
    approved_file: UploadFile = File(...),
    current_file: UploadFile = File(...),
) -> VersionDiff:
    approved_bytes = await _read_ifc_upload(approved_file)
    current_bytes = await _read_ifc_upload(current_file)
    try:
        approved = IFCAuditor(approved_bytes)
        current = IFCAuditor(current_bytes)
        approved_storeys = approved.parse_storeys()
        current_storeys = current.parse_storeys()
        approved_columns = approved.parse_columns(approved_storeys)
        current_columns = current.parse_columns(current_storeys)
        approved_stairs = approved.parse_stairs(approved_storeys)
        current_stairs = current.parse_stairs(current_storeys)
        approved_elements = approved.extract_3d_elements(approved_storeys, approved_columns, approved_stairs)
        current_elements = current.extract_3d_elements(current_storeys, current_columns, current_stairs)

        approved_storey_names = {storey["name"] for storey in approved_storeys}
        current_storey_names = {storey["name"] for storey in current_storeys}
        approved_by_guid = {column["global_id"]: column for column in approved_columns}
        current_by_guid = {column["global_id"]: column for column in current_columns}
        added_guids = current_by_guid.keys() - approved_by_guid.keys()
        removed_guids = approved_by_guid.keys() - current_by_guid.keys()
        added = [
            element.model_copy(update={"change_status": "added", "color_hint": "#16a34a"})
            for element in current_elements
            if element.guid in added_guids
        ]
        removed = [
            element.model_copy(update={"change_status": "removed", "color_hint": "#dc2626"})
            for element in approved_elements
            if element.guid in removed_guids
        ]
        approved_elements_by_guid = {element.guid: element for element in approved_elements}
        current_elements_by_guid = {element.guid: element for element in current_elements}
        added_elements = [
            element.model_copy(update={"change_status": "added", "color_hint": "#16a34a"})
            for guid, element in current_elements_by_guid.items()
            if guid not in approved_elements_by_guid
        ]
        removed_elements = [
            element.model_copy(update={"change_status": "removed", "color_hint": "#dc2626"})
            for guid, element in approved_elements_by_guid.items()
            if guid not in current_elements_by_guid
        ]
        changed = []
        for guid in current_by_guid.keys() & approved_by_guid.keys():
            old = approved_by_guid[guid]
            new = current_by_guid[guid]
            old_section = (old["width_mm"], old["depth_mm"])
            new_section = (new["width_mm"], new["depth_mm"])
            if None not in old_section and None not in new_section and old_section != new_section:
                changed.append({
                    "guid": guid,
                    "name": new["name"],
                    "approved_section_mm": list(old_section),
                    "current_section_mm": list(new_section),
                })

        approved_height = _height_from_storeys(approved_storeys) if approved.has_length_units else None
        current_height = _height_from_storeys(current_storeys) if current.has_length_units else None
        approved_area = _footprint_area_m2(approved.model)
        current_area = _footprint_area_m2(current.model)
        statuses = {
            "storeys": CheckStatusValue.PASSED if approved_storeys and current_storeys else CheckStatusValue.COULD_NOT_CHECK,
            "columns": CheckStatusValue.PASSED if approved_columns and current_columns and approved.has_length_units and current.has_length_units and all(column["min_dimension_mm"] is not None for column in approved_columns + current_columns) else CheckStatusValue.COULD_NOT_CHECK,
            "height": CheckStatusValue.PASSED if approved_height is not None and current_height is not None and approved.has_length_units and current.has_length_units else CheckStatusValue.COULD_NOT_CHECK,
            "footprint": CheckStatusValue.PASSED if approved_area is not None and current_area is not None else CheckStatusValue.COULD_NOT_CHECK,
        }
        return VersionDiff(
            storeys_added=sorted(current_storey_names - approved_storey_names),
            storeys_removed=sorted(approved_storey_names - current_storey_names),
            columns_added=added,
            columns_removed=removed,
            added_elements=added_elements,
            removed_elements=removed_elements,
            columns_changed=changed,
            approved_height_m=approved_height,
            current_height_m=current_height,
            height_change_m=round(current_height - approved_height, 3) if approved_height is not None and current_height is not None else None,
            approved_footprint_area_m2=approved_area,
            current_footprint_area_m2=current_area,
            footprint_change_m2=round(current_area - approved_area, 3) if approved_area is not None and current_area is not None else None,
            statuses=statuses,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not compare IFC models: {exc}") from exc


@router.get(
    "/plans/sample-audit/{sample_name}",
    response_model=AuditResponse,
    summary="Run Audit on Built-in Synthetic Sample",
    tags=["Audit"],
)
def audit_sample_plan(
    sample_name: str,
    max_permitted_floors: int = 4,
    min_column_dim_mm: float = 200.0,
    county: str = "Nairobi City County",
    zoning_zone: str = "Nairobi Zone 14 (Kasarani / Pipeline)",
) -> AuditResponse:
    """
    Convenience endpoint for frontend testing with synthetic fixtures:
    sample_name can be 'violating' or 'compliant'.
    """
    clean_name = "violating_building.ifc" if "violat" in sample_name.lower() else "compliant_building.ifc"
    file_path = FIXTURES_DIR / clean_name

    if not file_path.exists():
        from tests.generate_synthetic_ifc import generate_compliant_building, generate_violating_building
        FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
        if "violat" in sample_name.lower():
            generate_violating_building(str(file_path))
        else:
            generate_compliant_building(str(file_path))

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    auditor = IFCAuditor(file_bytes)
    parcel_id = "DEMO-PARCEL-001"
    parcel = next((p for p in _mock_parcels() if p["id"] == parcel_id), None)
    if parcel is None:
        raise HTTPException(status_code=500, detail="Synthetic fixture parcel is missing from mock parcel records.")
    result = auditor.audit(
        parcel_id=parcel_id,
        max_permitted_floors=parcel["permitted_storeys"],
        min_column_dim_mm=min_column_dim_mm,
    )
    result.county = parcel["county"]
    result.zoning_zone = parcel["zone"]
    result.audit_id = save_audit_result(result)
    link_audit_to_parcel(parcel_id, result.audit_id)
    return result


@router.get(
    "/plans/sample-file/{sample_name}",
    summary="Download Sample IFC File",
    tags=["Audit"],
)
def download_sample_file(sample_name: str):
    """Download synthetic sample IFC file for manual testing in the dropzone."""
    clean_name = "violating_building.ifc" if "violat" in sample_name.lower() else "compliant_building.ifc"
    file_path = FIXTURES_DIR / clean_name

    if not file_path.exists():
        from tests.generate_synthetic_ifc import generate_compliant_building, generate_violating_building
        FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
        if "violat" in sample_name.lower():
            generate_violating_building(str(file_path))
        else:
            generate_compliant_building(str(file_path))

    return FileResponse(
        path=str(file_path),
        filename=clean_name,
        media_type="application/octet-stream",
    )
