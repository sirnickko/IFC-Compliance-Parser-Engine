import hashlib
import os
import tempfile
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

import ifcopenshell

from ..models.schemas import (
    AuditResponse,
    AuditSummary,
    BuildingMetadata,
    Element3DGeometry,
    Finding,
    OverallStatus,
    Severity,
    StoreyInfo,
)
from .rules import RulesEngine


class IFCAuditor:
    """
    Core parsing, provenance, 3D geometry extraction, and compliance evaluation engine.
    """

    def __init__(self, file_bytes: bytes):
        self.file_bytes = file_bytes
        self.file_sha256 = hashlib.sha256(file_bytes).hexdigest()
        self.model = self._load_model(file_bytes)
        self.unit_to_mm = self._detect_unit_to_mm()

    @staticmethod
    def _load_model(file_bytes: bytes) -> ifcopenshell.file:
        fd, temp_path = tempfile.mkstemp(suffix=".ifc")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(file_bytes)
            model = ifcopenshell.open(temp_path)
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
        return model

    def _detect_unit_to_mm(self) -> float:
        try:
            for assignment in self.model.by_type("IfcUnitAssignment"):
                for unit in assignment.Units:
                    if getattr(unit, "UnitType", None) == "LENGTHUNIT":
                        if unit.is_a("IfcSIUnit"):
                            prefix = getattr(unit, "Prefix", None)
                            if prefix == "MILLI":
                                return 1.0
                            if prefix == "CENTI":
                                return 10.0
                            return 1000.0  # Base metre
                        if unit.is_a("IfcConversionBasedUnit"):
                            factor = unit.ConversionFactor
                            if factor and factor.ValueComponent:
                                return float(factor.ValueComponent.wrappedValue) * 1000.0
        except Exception:
            pass
        return 1.0

    @staticmethod
    def _walk_placement(placement, unit_to_mm: float) -> Tuple[float, float, float]:
        x, y, z = 0.0, 0.0, 0.0
        current = placement
        while current is not None:
            rel = getattr(current, "RelativePlacement", None)
            if rel is not None:
                loc = getattr(rel, "Location", None)
                if loc is not None:
                    coords = list(loc.Coordinates)
                    x += coords[0] if len(coords) > 0 else 0.0
                    y += coords[1] if len(coords) > 1 else 0.0
                    z += coords[2] if len(coords) > 2 else 0.0
            current = getattr(current, "PlacementRelTo", None)
        return x * unit_to_mm, y * unit_to_mm, z * unit_to_mm

    def _extract_column_dimensions(self, column) -> Dict[str, Any]:
        unit_to_mm = self.unit_to_mm
        # Try profile from representation
        rep = column.Representation
        if rep:
            for shape_rep in rep.Representations or []:
                for item in shape_rep.Items or []:
                    swept_area = getattr(item, "SweptArea", None)
                    if swept_area:
                        if swept_area.is_a("IfcRectangleProfileDef"):
                            w = float(swept_area.XDim) * unit_to_mm
                            d = float(swept_area.YDim) * unit_to_mm
                            depth = float(getattr(item, "Depth", 3000.0)) * unit_to_mm
                            return {
                                "type": "rectangular",
                                "width_mm": w,
                                "depth_mm": d,
                                "height_mm": depth,
                                "min_dim_mm": min(w, d),
                            }
                        if swept_area.is_a("IfcCircleProfileDef"):
                            dia = float(swept_area.Radius) * 2.0 * unit_to_mm
                            depth = float(getattr(item, "Depth", 3000.0)) * unit_to_mm
                            return {
                                "type": "circular",
                                "width_mm": dia,
                                "depth_mm": dia,
                                "height_mm": depth,
                                "min_dim_mm": dia,
                            }

        # Fallback to Property Sets
        width = depth = diameter = None
        for rel in getattr(column, "IsDefinedBy", []) or []:
            if rel.is_a("IfcRelDefinesByProperties"):
                pset = rel.RelatingPropertyDefinition
                if pset and pset.is_a("IfcPropertySet"):
                    for prop in pset.HasProperties or []:
                        if prop.is_a("IfcPropertySingleValue") and prop.NominalValue:
                            try:
                                val = float(prop.NominalValue.wrappedValue) * unit_to_mm
                                name = prop.Name.lower()
                                if "width" in name:
                                    width = val
                                elif "depth" in name:
                                    depth = val
                                elif "diameter" in name:
                                    diameter = val
                            except (ValueError, TypeError):
                                pass

        if diameter is not None:
            return {"type": "circular", "width_mm": diameter, "depth_mm": diameter, "height_mm": 3000.0, "min_dim_mm": diameter}
        if width is not None and depth is not None:
            return {"type": "rectangular", "width_mm": width, "depth_mm": depth, "height_mm": 3000.0, "min_dim_mm": min(width, depth)}
        if width is not None:
            return {"type": "rectangular", "width_mm": width, "depth_mm": width, "height_mm": 3000.0, "min_dim_mm": width}

        # Default fallback
        return {"type": "rectangular", "width_mm": 300.0, "depth_mm": 300.0, "height_mm": 3000.0, "min_dim_mm": 300.0}

    def parse_storeys(self) -> List[Dict[str, Any]]:
        raw_storeys = self.model.by_type("IfcBuildingStorey")
        storeys = []
        for s in raw_storeys:
            elev_native = s.Elevation if s.Elevation is not None else 0.0
            elev_mm = float(elev_native) * self.unit_to_mm
            storeys.append({
                "entity": s,
                "global_id": s.GlobalId,
                "name": s.Name or f"Level {len(storeys)}",
                "elevation_mm": elev_mm,
                "elevation_m": round(elev_mm / 1000.0, 3),
            })
        storeys.sort(key=lambda s: s["elevation_mm"])
        return storeys

    def parse_columns(self, storeys: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        raw_columns = self.model.by_type("IfcColumn")
        columns: List[Dict[str, Any]] = []

        # Map elements to storeys via spatial containment
        storey_by_elem_id: Dict[int, Dict[str, Any]] = {}
        for rel in self.model.by_type("IfcRelContainedInSpatialStructure"):
            structure = rel.RelatingStructure
            if structure and structure.is_a("IfcBuildingStorey"):
                s_dict = next((s for s in storeys if s["global_id"] == structure.GlobalId), None)
                if s_dict:
                    for elem in rel.RelatedElements or []:
                        storey_by_elem_id[elem.id()] = s_dict

        for col in raw_columns:
            guid = col.GlobalId
            name = col.Name or f"COL-{guid[:6]}"
            dims = self._extract_column_dimensions(col)
            s_dict = storey_by_elem_id.get(col.id())

            # Position
            x_mm, y_mm, z_mm = 0.0, 0.0, 0.0
            if col.ObjectPlacement:
                x_mm, y_mm, z_mm = self._walk_placement(col.ObjectPlacement, self.unit_to_mm)

            if s_dict and z_mm == 0.0:
                z_mm = s_dict["elevation_mm"]

            columns.append({
                "entity": col,
                "global_id": guid,
                "name": name,
                "storey_name": s_dict["name"] if s_dict else "Unknown",
                "storey_id": s_dict["global_id"] if s_dict else None,
                "x_mm": x_mm,
                "y_mm": y_mm,
                "z_mm": z_mm,
                "width_mm": dims.get("width_mm", 300.0),
                "depth_mm": dims.get("depth_mm", 300.0),
                "height_mm": dims.get("height_mm", 3000.0),
                "min_dimension_mm": dims.get("min_dim_mm", 300.0),
                "profile_type": dims.get("type", "rectangular"),
            })

        return columns

    def parse_stairs(self, storeys: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        raw_stairs = list(self.model.by_type("IfcStair")) + list(self.model.by_type("IfcStairFlight"))
        stairs: List[Dict[str, Any]] = []

        storey_by_elem_id: Dict[int, Dict[str, Any]] = {}
        for rel in self.model.by_type("IfcRelContainedInSpatialStructure"):
            structure = rel.RelatingStructure
            if structure and structure.is_a("IfcBuildingStorey"):
                s_dict = next((s for s in storeys if s["global_id"] == structure.GlobalId), None)
                if s_dict:
                    for elem in rel.RelatedElements or []:
                        storey_by_elem_id[elem.id()] = s_dict

        seen_guids = set()
        for st in raw_stairs:
            guid = st.GlobalId
            if guid in seen_guids:
                continue
            seen_guids.add(guid)

            name = st.Name or f"STAIR-{guid[:6]}"
            s_dict = storey_by_elem_id.get(st.id())

            x_mm, y_mm, z_mm = 0.0, 0.0, 0.0
            if st.ObjectPlacement:
                x_mm, y_mm, z_mm = self._walk_placement(st.ObjectPlacement, self.unit_to_mm)
            if s_dict and z_mm == 0.0:
                z_mm = s_dict["elevation_mm"]

            stairs.append({
                "entity": st,
                "global_id": guid,
                "name": name,
                "type": st.is_a(),
                "storey_name": s_dict["name"] if s_dict else "Unknown",
                "x_mm": x_mm,
                "y_mm": y_mm,
                "z_mm": z_mm,
            })

        return stairs

    def extract_3d_elements(
        self,
        storeys: List[Dict[str, Any]],
        columns: List[Dict[str, Any]],
        stairs: List[Dict[str, Any]],
    ) -> List[Element3DGeometry]:
        elements: List[Element3DGeometry] = []

        # Determine structural bounding box in mm
        xs = [c["x_mm"] for c in columns] or [0.0, 8000.0]
        ys = [c["y_mm"] for c in columns] or [0.0, 8000.0]
        min_x, max_x = min(xs) - 1000.0, max(xs) + 1000.0
        min_y, max_y = min(ys) - 1000.0, max(ys) + 1000.0
        slab_w = max(max_x - min_x, 6000.0)
        slab_d = max(max_y - min_y, 6000.0)
        slab_cx = (min_x + max_x) / 2.0
        slab_cy = (min_y + max_y) / 2.0
        slab_thickness_mm = 250.0

        # 1. Storey Slabs
        for s in storeys:
            elev_mm = s["elevation_mm"]
            # Position: Three.js coordinates (X: x, Y: elevation (up), Z: y) in meters
            elements.append(
                Element3DGeometry(
                    guid=s["global_id"],
                    name=s["name"],
                    type="IfcBuildingStorey",
                    storey=s["name"],
                    position=[
                        round(slab_cx / 1000.0, 3),
                        round((elev_mm - slab_thickness_mm / 2.0) / 1000.0, 3),
                        round(slab_cy / 1000.0, 3),
                    ],
                    dimensions=[
                        round(slab_w / 1000.0, 3),
                        round(slab_thickness_mm / 1000.0, 3),
                        round(slab_d / 1000.0, 3),
                    ],
                    color_hint="#94A3B8",
                )
            )

        # 2. Columns
        for c in columns:
            w_m = round(c["width_mm"] / 1000.0, 3)
            d_m = round(c["depth_mm"] / 1000.0, 3)
            h_m = round(c["height_mm"] / 1000.0, 3)
            x_m = round(c["x_mm"] / 1000.0, 3)
            z_m = round(c["y_mm"] / 1000.0, 3)
            y_base_m = round(c["z_mm"] / 1000.0, 3)
            y_center_m = round(y_base_m + (h_m / 2.0), 3)

            elements.append(
                Element3DGeometry(
                    guid=c["global_id"],
                    name=c["name"],
                    type="IfcColumn",
                    storey=c["storey_name"],
                    position=[x_m, y_center_m, z_m],
                    dimensions=[w_m, h_m, d_m],
                    color_hint="#CBD5E1",
                )
            )

        # 3. Stairs
        for st in stairs:
            x_m = round(st["x_mm"] / 1000.0, 3)
            z_m = round(st["y_mm"] / 1000.0, 3)
            y_m = round(st["z_mm"] / 1000.0, 3)
            # Default stair dimension: 2m wide, 3m rise, 3.5m run
            elements.append(
                Element3DGeometry(
                    guid=st["global_id"],
                    name=st["name"],
                    type=st["type"],
                    storey=st["storey_name"],
                    position=[x_m + 1.0, y_m + 1.5, z_m + 1.5],
                    dimensions=[1.5, 3.0, 3.0],
                    color_hint="#64748B",
                )
            )

        return elements

    def audit(
        self,
        parcel_id: str,
        max_permitted_floors: int = 4,
        min_column_dim_mm: float = 200.0,
    ) -> AuditResponse:
        storeys = self.parse_storeys()
        columns = self.parse_columns(storeys)
        stairs = self.parse_stairs(storeys)

        engine = RulesEngine(
            max_permitted_floors=max_permitted_floors,
            min_column_dim_mm=min_column_dim_mm,
        )
        findings = engine.evaluate_all(self.model, storeys, columns, stairs)

        critical_count = sum(1 for f in findings if f.severity == Severity.CRITICAL)
        warning_count = sum(1 for f in findings if f.severity == Severity.WARNING)

        if critical_count > 0:
            overall_status = OverallStatus.REJECTED
        elif warning_count > 0:
            overall_status = OverallStatus.FLAGGED_FOR_REVIEW
        else:
            overall_status = OverallStatus.APPROVED

        # Metadata
        proj = next(iter(self.model.by_type("IfcProject")), None)
        proj_name = proj.Name if proj else "IFC Project"

        total_height_m = None
        if storeys:
            total_height_m = round((storeys[-1]["elevation_mm"] + 3000.0) / 1000.0, 2)

        storey_infos = [
            StoreyInfo(
                name=s["name"],
                global_id=s["global_id"],
                elevation_m=s["elevation_m"],
                height_m=3.0,
            )
            for s in storeys
        ]

        metadata = BuildingMetadata(
            project_name=proj_name,
            schema_version=getattr(self.model, "schema", "IFC4"),
            creation_timestamp=datetime.now(timezone.utc).isoformat(),
            total_storeys=len(storeys),
            storeys=storey_infos,
            total_building_height_m=total_height_m,
            total_columns=len(columns),
            total_stairs=len(stairs),
        )

        elements_3d = self.extract_3d_elements(storeys, columns, stairs)

        summary = AuditSummary(
            total_elements_audited=len(storeys) + len(columns) + len(stairs),
            total_findings=len(findings),
            critical_count=critical_count,
            warning_count=warning_count,
            passed_checks=max(0, 4 - len(findings)),
            overall_status=overall_status,
        )

        return AuditResponse(
            file_sha256=self.file_sha256,
            parcel_id=parcel_id,
            audit_timestamp=datetime.now(timezone.utc).isoformat(),
            overall_status=overall_status,
            metadata=metadata,
            summary=summary,
            findings=findings,
            elements_3d=elements_3d,
        )
