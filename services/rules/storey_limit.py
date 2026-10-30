from __future__ import annotations

from typing import Any

import ifcopenshell

from schemas.compliance import RuleResult, ViolationDetail
from services.rules.base import BaseRule


class StoreyLimitRule(BaseRule):

    @property
    def rule_id(self) -> str:
        return "RULE_A_STOREY_LIMIT"

    @property
    def rule_name(self) -> str:
        return "Maximum Storey / Height Audit"

    def evaluate(
        self,
        model: ifcopenshell.file,
        unit_to_mm: float,
        params: dict[str, Any],
    ) -> RuleResult:
        max_floors = params.get("max_permitted_floors", 5)
        storeys = model.by_type("IfcBuildingStorey")
        detected_count = len(storeys)

        violations: list[ViolationDetail] = []

        if detected_count > max_floors:
            sorted_storeys = sorted(
                storeys,
                key=lambda s: s.Elevation if s.Elevation is not None else 0.0,
            )
            for storey in sorted_storeys[max_floors:]:
                violations.append(
                    ViolationDetail(
                        element_guid=storey.GlobalId,
                        element_type="IfcBuildingStorey",
                        description=(
                            f"Storey '{storey.Name or 'Unnamed'}' exceeds the "
                            f"permitted maximum of {max_floors} floors"
                        ),
                        detected_value=float(detected_count),
                    )
                )

        passed = len(violations) == 0
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            passed=passed,
            message=(
                f"Building has {detected_count} storey(s); "
                f"limit is {max_floors}. "
                + ("PASS" if passed else f"FAIL — {len(violations)} excess storey(s)")
            ),
            detected_values={
                "detected_storeys": detected_count,
                "max_permitted_floors": max_floors,
                "elements_checked": detected_count,
            },
            violations=violations,
        )
