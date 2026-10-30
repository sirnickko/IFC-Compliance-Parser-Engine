from __future__ import annotations

from typing import Any, Optional

import ifcopenshell

from schemas.compliance import RuleResult, ViolationDetail
from services.rules.base import BaseRule


class ColumnDimensionRule(BaseRule):

    @property
    def rule_id(self) -> str:
        return "RULE_B_COLUMN_DIMENSION"

    @property
    def rule_name(self) -> str:
        return "Structural Column Cross-Section Check"

    @staticmethod
    def _dims_from_profile(profile, unit_to_mm: float) -> Optional[dict]:
        """Extract dimensions from an IfcProfileDef subtype."""
        if profile.is_a("IfcRectangleProfileDef"):
            w = profile.XDim * unit_to_mm
            d = profile.YDim * unit_to_mm
            return {"type": "rectangular", "width_mm": w, "depth_mm": d, "min_dim_mm": min(w, d)}
        if profile.is_a("IfcCircleProfileDef"):
            dia = profile.Radius * 2.0 * unit_to_mm
            return {"type": "circular", "diameter_mm": dia, "min_dim_mm": dia}
        if profile.is_a("IfcIShapeProfileDef"):
            w = profile.OverallWidth * unit_to_mm
            d = profile.OverallDepth * unit_to_mm
            return {"type": "i_shape", "width_mm": w, "depth_mm": d, "min_dim_mm": min(w, d)}
        return None

    def _extract_profile_from_rep(self, column, unit_to_mm: float) -> Optional[dict]:
        """Walk the representation tree looking for a swept-solid profile."""
        rep = column.Representation
        if not rep:
            return None
        for shape_rep in rep.Representations or []:
            for item in shape_rep.Items or []:
                if hasattr(item, "SweptArea") and item.SweptArea:
                    dims = self._dims_from_profile(item.SweptArea, unit_to_mm)
                    if dims:
                        return dims
                if hasattr(item, "MappingSource") and item.MappingSource:
                    mapped_rep = item.MappingSource.MappedRepresentation
                    if mapped_rep:
                        for mi in mapped_rep.Items or []:
                            if hasattr(mi, "SweptArea") and mi.SweptArea:
                                dims = self._dims_from_profile(mi.SweptArea, unit_to_mm)
                                if dims:
                                    return dims
        return None

    @staticmethod
    def _extract_dims_from_psets(column, unit_to_mm: float) -> Optional[dict]:
        """Fallback: look for Width / Depth / Diameter in property sets."""
        try:
            defined_by = column.IsDefinedBy or []
        except Exception:
            return None

        width = depth = diameter = None
        for rel in defined_by:
            if not rel.is_a("IfcRelDefinesByProperties"):
                continue
            pset = rel.RelatingPropertyDefinition
            if not pset or not pset.is_a("IfcPropertySet"):
                continue
            for prop in pset.HasProperties or []:
                if not prop.is_a("IfcPropertySingleValue") or not prop.NominalValue:
                    continue
                val = float(prop.NominalValue.wrappedValue) * unit_to_mm
                name_lower = prop.Name.lower()
                if "width" in name_lower:
                    width = val
                elif "depth" in name_lower:
                    depth = val
                elif "diameter" in name_lower:
                    diameter = val

        if diameter is not None:
            return {"type": "circular", "diameter_mm": diameter, "min_dim_mm": diameter}
        if width is not None and depth is not None:
            return {"type": "rectangular", "width_mm": width, "depth_mm": depth, "min_dim_mm": min(width, depth)}
        if width is not None:
            return {"type": "unknown", "min_dim_mm": width}
        if depth is not None:
            return {"type": "unknown", "min_dim_mm": depth}
        return None

    def evaluate(
        self,
        model: ifcopenshell.file,
        unit_to_mm: float,
        params: dict[str, Any],
    ) -> RuleResult:
        min_dim_threshold = params.get("min_column_dim_mm", 200.0)
        columns = model.by_type("IfcColumn")
        violations: list[ViolationDetail] = []

        for col in columns:
            dims = self._extract_profile_from_rep(col, unit_to_mm)
            if dims is None:
                dims = self._extract_dims_from_psets(col, unit_to_mm)
            if dims is None:
                violations.append(
                    ViolationDetail(
                        element_guid=col.GlobalId,
                        element_type="IfcColumn",
                        description=(
                            f"Column '{col.Name or 'Unnamed'}' — unable to extract "
                            "cross-section dimensions from geometry or property sets"
                        ),
                        detected_value=None,
                    )
                )
                continue

            if dims["min_dim_mm"] < min_dim_threshold:
                violations.append(
                    ViolationDetail(
                        element_guid=col.GlobalId,
                        element_type="IfcColumn",
                        description=(
                            f"Column '{col.Name or 'Unnamed'}' has a minimum "
                            f"cross-section of {dims['min_dim_mm']:.1f} mm, below "
                            f"the required {min_dim_threshold:.1f} mm"
                        ),
                        detected_value=dims["min_dim_mm"],
                    )
                )

        passed = len(violations) == 0
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            passed=passed,
            message=(
                f"Checked {len(columns)} column(s) against "
                f"{min_dim_threshold:.0f} mm minimum. "
                + ("PASS" if passed else f"FAIL — {len(violations)} violation(s)")
            ),
            detected_values={
                "total_columns": len(columns),
                "min_column_dim_mm_threshold": min_dim_threshold,
                "undersized_columns": len(violations),
                "elements_checked": len(columns),
            },
            violations=violations,
        )
