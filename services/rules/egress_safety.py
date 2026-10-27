"""
Rule C — Vertical Egress & Stair Audit.

Validates that every multi-storey building contains at least one
designated vertical egress stair (``IfcStair`` or ``IfcStairFlight``).
For buildings with more than two storeys the rule also checks that
stairs exist on every storey except the topmost (there must be a
connecting stair between each pair of adjacent floors).
"""

from __future__ import annotations

from typing import Any

import ifcopenshell

from schemas.compliance import RuleResult, ViolationDetail
from services.rules.base import BaseRule


class EgressSafetyRule(BaseRule):

    @property
    def rule_id(self) -> str:
        return "RULE_C_EGRESS_SAFETY"

    @property
    def rule_name(self) -> str:
        return "Vertical Egress & Stair Audit"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _storeys_with_stairs(model: ifcopenshell.file) -> set[str]:
        """Return the set of storey GlobalIds that contain at least one stair element."""
        guids: set[str] = set()
        for rel in model.by_type("IfcRelContainedInSpatialStructure"):
            structure = rel.RelatingStructure
            if not structure.is_a("IfcBuildingStorey"):
                continue
            for elem in rel.RelatedElements or []:
                if elem.is_a("IfcStair") or elem.is_a("IfcStairFlight"):
                    guids.add(structure.GlobalId)
                    break
        return guids

    # ------------------------------------------------------------------
    # Rule evaluation
    # ------------------------------------------------------------------

    def evaluate(
        self,
        model: ifcopenshell.file,
        unit_to_mm: float,
        params: dict[str, Any],
    ) -> RuleResult:
        storeys = model.by_type("IfcBuildingStorey")
        total_stairs = len(model.by_type("IfcStair")) + len(model.by_type("IfcStairFlight"))
        violations: list[ViolationDetail] = []

        if len(storeys) <= 1:
            # Single-storey building — stairs not mandatory
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                passed=True,
                message="Single-storey building — vertical egress stairs not required.",
                detected_values={
                    "total_storeys": len(storeys),
                    "total_stair_elements": total_stairs,
                    "elements_checked": len(storeys),
                },
            )

        # Multi-storey: at least one stair must exist globally
        if total_stairs == 0:
            violations.append(
                ViolationDetail(
                    element_guid="N/A",
                    element_type="IfcBuilding",
                    description=(
                        "Multi-storey building has NO vertical egress stairs "
                        "(IfcStair / IfcStairFlight) anywhere in the model"
                    ),
                    detected_value=0,
                )
            )
        else:
            # Check per-storey coverage (all storeys except the topmost
            # should host a stair connecting to the floor above)
            sorted_storeys = sorted(
                storeys,
                key=lambda s: s.Elevation if s.Elevation is not None else 0.0,
            )
            guids_with_stairs = self._storeys_with_stairs(model)

            # Every storey except the topmost should have a stair
            for storey in sorted_storeys[:-1]:
                if storey.GlobalId not in guids_with_stairs:
                    violations.append(
                        ViolationDetail(
                            element_guid=storey.GlobalId,
                            element_type="IfcBuildingStorey",
                            description=(
                                f"Storey '{storey.Name or 'Unnamed'}' at elevation "
                                f"{storey.Elevation} lacks a vertical egress stair"
                            ),
                            detected_value=storey.Elevation,
                        )
                    )

        passed = len(violations) == 0
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            passed=passed,
            message=(
                f"{len(storeys)} storey(s), {total_stairs} stair element(s) found. "
                + ("PASS" if passed else f"FAIL — {len(violations)} storey(s) lack egress stairs")
            ),
            detected_values={
                "total_storeys": len(storeys),
                "total_stair_elements": total_stairs,
                "storeys_missing_stairs": len(violations),
                "elements_checked": len(storeys),
            },
            violations=violations,
        )
