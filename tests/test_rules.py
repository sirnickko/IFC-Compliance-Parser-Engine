"""
Unit tests for all four compliance rules.

Each rule is tested independently against both the compliant and
violating synthetic fixtures.
"""

from __future__ import annotations

import ifcopenshell
import pytest

from services.ifc_parser import IFCAuditor
from services.rules.storey_limit import StoreyLimitRule
from services.rules.column_dimension import ColumnDimensionRule
from services.rules.egress_safety import EgressSafetyRule
from services.rules.column_continuity import ColumnContinuityRule


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────

def _auditor(raw: bytes) -> IFCAuditor:
    return IFCAuditor(raw)


PARAMS_DEFAULT = {
    "max_permitted_floors": 5,
    "min_column_dim_mm": 200.0,
    "column_continuity_tolerance_mm": 500.0,
}


# ══════════════════════════════════════════════════════════════════════
#  RULE A — Storey Limit
# ══════════════════════════════════════════════════════════════════════

class TestStoreyLimitRule:

    rule = StoreyLimitRule()

    def test_compliant_passes(self, compliant_bytes: bytes):
        a = _auditor(compliant_bytes)
        result = self.rule.evaluate(a.model, a.unit_to_mm, PARAMS_DEFAULT)
        assert result.passed is True
        assert result.detected_values["detected_storeys"] == 4

    def test_violating_fails(self, violating_bytes: bytes):
        a = _auditor(violating_bytes)
        result = self.rule.evaluate(a.model, a.unit_to_mm, PARAMS_DEFAULT)
        assert result.passed is False
        assert result.detected_values["detected_storeys"] == 8
        # Should flag the 3 excess storeys (8 - 5 = 3)
        assert len(result.violations) == 3

    def test_exact_limit_passes(self, compliant_bytes: bytes):
        """4 storeys with max_permitted_floors=4 should still pass."""
        a = _auditor(compliant_bytes)
        params = {**PARAMS_DEFAULT, "max_permitted_floors": 4}
        result = self.rule.evaluate(a.model, a.unit_to_mm, params)
        assert result.passed is True


# ══════════════════════════════════════════════════════════════════════
#  RULE B — Column Dimension
# ══════════════════════════════════════════════════════════════════════

class TestColumnDimensionRule:

    rule = ColumnDimensionRule()

    def test_compliant_passes(self, compliant_bytes: bytes):
        a = _auditor(compliant_bytes)
        result = self.rule.evaluate(a.model, a.unit_to_mm, PARAMS_DEFAULT)
        assert result.passed is True
        assert result.detected_values["total_columns"] == 16  # 4 storeys × 4 cols

    def test_violating_fails(self, violating_bytes: bytes):
        a = _auditor(violating_bytes)
        result = self.rule.evaluate(a.model, a.unit_to_mm, PARAMS_DEFAULT)
        assert result.passed is False
        # All columns are 150 mm < 200 mm threshold
        assert len(result.violations) > 0
        for v in result.violations:
            assert v.detected_value is not None
            assert v.detected_value < 200.0

    def test_custom_threshold(self, violating_bytes: bytes):
        """Lowering threshold to 100 mm should make 150 mm columns pass."""
        a = _auditor(violating_bytes)
        params = {**PARAMS_DEFAULT, "min_column_dim_mm": 100.0}
        result = self.rule.evaluate(a.model, a.unit_to_mm, params)
        assert result.passed is True


# ══════════════════════════════════════════════════════════════════════
#  RULE C — Egress Safety
# ══════════════════════════════════════════════════════════════════════

class TestEgressSafetyRule:

    rule = EgressSafetyRule()

    def test_compliant_passes(self, compliant_bytes: bytes):
        a = _auditor(compliant_bytes)
        result = self.rule.evaluate(a.model, a.unit_to_mm, PARAMS_DEFAULT)
        assert result.passed is True
        assert result.detected_values["total_stair_elements"] > 0

    def test_violating_fails(self, violating_bytes: bytes):
        a = _auditor(violating_bytes)
        result = self.rule.evaluate(a.model, a.unit_to_mm, PARAMS_DEFAULT)
        assert result.passed is False
        # Stairs exist only on levels 0-3, levels 4-6 are missing stairs
        assert result.detected_values["storeys_missing_stairs"] >= 3


# ══════════════════════════════════════════════════════════════════════
#  RULE D — Column Continuity
# ══════════════════════════════════════════════════════════════════════

class TestColumnContinuityRule:

    rule = ColumnContinuityRule()

    def test_compliant_passes(self, compliant_bytes: bytes):
        a = _auditor(compliant_bytes)
        result = self.rule.evaluate(a.model, a.unit_to_mm, PARAMS_DEFAULT)
        assert result.passed is True
        assert result.detected_values["floating_columns"] == 0

    def test_violating_fails(self, violating_bytes: bytes):
        a = _auditor(violating_bytes)
        result = self.rule.evaluate(a.model, a.unit_to_mm, PARAMS_DEFAULT)
        assert result.passed is False
        assert result.detected_values["floating_columns"] >= 1
        # The floating column should be identified by GUID
        assert any("4000" in v.description for v in result.violations)
