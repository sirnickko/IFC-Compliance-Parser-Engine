"""
Rule D — Column Continuity Check.

Analyses column 2-D placement coordinates across adjacent storeys and
flags *floating* or *discontinued* columns — i.e. columns present on an
upper storey with no structurally supporting column at a matching XY
position on the storey directly below.

A configurable XY tolerance (default 500 mm) accommodates minor
placement offsets between floors.
"""

from __future__ import annotations

import math
from typing import Any, Optional

import ifcopenshell

from schemas.compliance import RuleResult, ViolationDetail
from services.rules.base import BaseRule


class ColumnContinuityRule(BaseRule):

    @property
    def rule_id(self) -> str:
        return "RULE_D_COLUMN_CONTINUITY"

    @property
    def rule_name(self) -> str:
        return "Column Vertical Continuity Check"

    # ------------------------------------------------------------------
    # Placement helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _walk_placement_xy(placement, unit_to_mm: float) -> tuple[float, float]:
        """
        Accumulate XY translation by walking up the IfcLocalPlacement chain.

        Returns absolute (x, y) in millimetres.
        """
        x, y = 0.0, 0.0
        current = placement
        while current is not None:
            rel = getattr(current, "RelativePlacement", None)
            if rel is not None:
                loc = getattr(rel, "Location", None)
                if loc is not None:
                    coords = list(loc.Coordinates)
                    x += coords[0] if len(coords) > 0 else 0.0
                    y += coords[1] if len(coords) > 1 else 0.0
            current = getattr(current, "PlacementRelTo", None)
        return x * unit_to_mm, y * unit_to_mm

    def _get_column_xy(
        self, column, unit_to_mm: float
    ) -> Optional[tuple[float, float]]:
        """Return the global (x, y) position of a column in mm, or None."""
        placement = column.ObjectPlacement
        if placement is None:
            return None
        return self._walk_placement_xy(placement, unit_to_mm)

    # ------------------------------------------------------------------
    # Storey → column mapping
    # ------------------------------------------------------------------

    def _group_columns_by_storey(
        self,
        model: ifcopenshell.file,
        unit_to_mm: float,
    ) -> dict[str, list[tuple[Any, float, float]]]:
        """
        Return a mapping of storey GlobalId → list of (column, x_mm, y_mm).
        """
        result: dict[str, list[tuple[Any, float, float]]] = {}
        for rel in model.by_type("IfcRelContainedInSpatialStructure"):
            structure = rel.RelatingStructure
            if not structure.is_a("IfcBuildingStorey"):
                continue
            guid = structure.GlobalId
            if guid not in result:
                result[guid] = []
            for elem in rel.RelatedElements or []:
                if elem.is_a("IfcColumn"):
                    xy = self._get_column_xy(elem, unit_to_mm)
                    if xy is not None:
                        result[guid].append((elem, xy[0], xy[1]))
        return result

    # ------------------------------------------------------------------
    # Rule evaluation
    # ------------------------------------------------------------------

    def evaluate(
        self,
        model: ifcopenshell.file,
        unit_to_mm: float,
        params: dict[str, Any],
    ) -> RuleResult:
        tolerance_mm = params.get("column_continuity_tolerance_mm", 500.0)
        storeys = model.by_type("IfcBuildingStorey")

        if len(storeys) <= 1:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                passed=True,
                message="Single-storey building — column continuity not applicable.",
                detected_values={"total_storeys": len(storeys), "elements_checked": 0},
            )

        col_map = self._group_columns_by_storey(model, unit_to_mm)

        sorted_storeys = sorted(
            storeys,
            key=lambda s: s.Elevation if s.Elevation is not None else 0.0,
        )

        violations: list[ViolationDetail] = []
        total_checked = 0

        for idx in range(1, len(sorted_storeys)):
            upper = sorted_storeys[idx]
            lower = sorted_storeys[idx - 1]
            upper_cols = col_map.get(upper.GlobalId, [])
            lower_cols = col_map.get(lower.GlobalId, [])

            for col, ux, uy in upper_cols:
                total_checked += 1
                has_support = False
                for _, lx, ly in lower_cols:
                    dist = math.hypot(ux - lx, uy - ly)
                    if dist <= tolerance_mm:
                        has_support = True
                        break

                if not has_support:
                    violations.append(
                        ViolationDetail(
                            element_guid=col.GlobalId,
                            element_type="IfcColumn",
                            description=(
                                f"Column '{col.Name or 'Unnamed'}' on storey "
                                f"'{upper.Name or 'Unnamed'}' at ({ux:.0f}, {uy:.0f}) mm "
                                f"has no supporting column within {tolerance_mm:.0f} mm "
                                f"on storey '{lower.Name or 'Unnamed'}' below"
                            ),
                            detected_value=f"({ux:.0f}, {uy:.0f})",
                        )
                    )

        passed = len(violations) == 0
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            passed=passed,
            message=(
                f"Checked {total_checked} upper-storey column(s) for vertical "
                f"continuity (tolerance {tolerance_mm:.0f} mm). "
                + ("PASS" if passed else f"FAIL — {len(violations)} floating column(s)")
            ),
            detected_values={
                "columns_checked": total_checked,
                "floating_columns": len(violations),
                "tolerance_mm": tolerance_mm,
                "elements_checked": total_checked,
            },
            violations=violations,
        )
