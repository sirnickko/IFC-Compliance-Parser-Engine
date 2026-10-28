from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import ifcopenshell
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from ..core.config import (
    DEFAULT_MAX_PERMITTED_FLOORS,
    DEFAULT_MIN_COLUMN_DIM_MM,
    FIXTURES_DIR,
)
from ..models.schemas import AuditResponse
from ..services.ifc_auditor import IFCAuditor

router = APIRouter()


@router.get("/health", tags=["System"])
def health_check():
    """Health status and ifcopenshell version check."""
    return {
        "status": "healthy",
        "service": "CivicShield BIM/IFC Compliance Engine",
        "ifcopenshell_version": getattr(ifcopenshell, "__version__", "0.7.0+"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post(
    "/plans/audit",
    response_model=AuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Ingest & Audit IFC Plan",
    tags=["Audit"],
)
async def audit_plan(
    file: UploadFile = File(..., description="Uploaded .ifc BIM file"),
    parcel_id: str = Form(..., description="Municipal parcel / cadastral identifier"),
    max_permitted_floors: int = Form(
        DEFAULT_MAX_PERMITTED_FLOORS,
        description="Zoning code maximum permissible storeys",
    ),
    min_column_dim_mm: Optional[float] = Form(
        DEFAULT_MIN_COLUMN_DIM_MM,
        description="Minimum structural column dimension in millimetres",
    ),
) -> AuditResponse:
    """
    Accepts an IFC building model, computes SHA-256 fingerprint, verifies compliance against
    zoning height limits, column cross-sections, continuous vertical stair egress, and
    column vertical load path alignment.
    """
    filename = file.filename or ""
    if not (filename.lower().endswith(".ifc") or filename.lower().endswith(".step")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{filename}'. Only .ifc files are supported.",
        )

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    try:
        auditor = IFCAuditor(file_bytes)
        result = auditor.audit(
            parcel_id=parcel_id,
            max_permitted_floors=max_permitted_floors,
            min_column_dim_mm=min_column_dim_mm or DEFAULT_MIN_COLUMN_DIM_MM,
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse or audit IFC model: {str(exc)}",
        )


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
) -> AuditResponse:
    """
    Convenience endpoint for frontend testing and one-click demo:
    sample_name can be 'violating' or 'compliant'.
    """
    clean_name = "violating_building.ifc" if "violat" in sample_name.lower() else "compliant_building.ifc"
    file_path = FIXTURES_DIR / clean_name

    # Auto-generate if missing
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
    return auditor.audit(
        parcel_id="DEMO-PARCEL-7049",
        max_permitted_floors=max_permitted_floors,
        min_column_dim_mm=min_column_dim_mm,
    )


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
