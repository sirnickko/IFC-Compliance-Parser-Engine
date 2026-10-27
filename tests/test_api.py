"""
Integration tests for the FastAPI /api/v1/ifc/audit endpoint.

Uses the synchronous ``TestClient`` to exercise the full request →
parse → rules → response pipeline against both synthetic fixtures.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ──────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────

class TestHealthEndpoint:

    def test_health_returns_200(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "ifcopenshell_version" in data


# ──────────────────────────────────────────────────────────────────────
# Compliant audit
# ──────────────────────────────────────────────────────────────────────

class TestCompliantAudit:

    def test_overall_approved(self, compliant_ifc_path: str):
        with open(compliant_ifc_path, "rb") as f:
            resp = client.post(
                "/api/v1/ifc/audit",
                files={"file": ("compliant.ifc", f, "application/octet-stream")},
                data={
                    "parcel_id": "PARCEL-C001",
                    "max_permitted_floors": 5,
                    "min_column_dim_mm": 200.0,
                },
            )
        assert resp.status_code == 200
        cert = resp.json()
        assert cert["overall_status"] == "APPROVED"
        assert cert["parcel_id"] == "PARCEL-C001"
        assert len(cert["file_sha256"]) == 64
        assert cert["summary"]["failed_checks"] == 0
        assert cert["summary"]["passed_checks"] == 4
        assert len(cert["rules_breakdown"]) == 4
        for rule in cert["rules_breakdown"]:
            assert rule["passed"] is True

    def test_certificate_contains_metadata(self, compliant_ifc_path: str):
        with open(compliant_ifc_path, "rb") as f:
            resp = client.post(
                "/api/v1/ifc/audit",
                files={"file": ("compliant.ifc", f, "application/octet-stream")},
                data={
                    "parcel_id": "PARCEL-META",
                    "max_permitted_floors": 5,
                },
            )
        cert = resp.json()
        meta = cert["building_metadata"]
        assert meta["project_name"] == "Compliant Residential Tower"
        assert meta["total_storeys"] == 4
        assert meta["total_building_height_m"] is not None
        assert len(meta["storeys"]) == 4


# ──────────────────────────────────────────────────────────────────────
# Violating audit
# ──────────────────────────────────────────────────────────────────────

class TestViolatingAudit:

    def test_overall_rejected(self, violating_ifc_path: str):
        with open(violating_ifc_path, "rb") as f:
            resp = client.post(
                "/api/v1/ifc/audit",
                files={"file": ("violating.ifc", f, "application/octet-stream")},
                data={
                    "parcel_id": "PARCEL-V002",
                    "max_permitted_floors": 5,
                    "min_column_dim_mm": 200.0,
                },
            )
        assert resp.status_code == 200
        cert = resp.json()
        assert cert["overall_status"] == "REJECTED"
        assert cert["parcel_id"] == "PARCEL-V002"
        assert cert["summary"]["failed_checks"] >= 3  # Rules A, B, C at minimum

    def test_storey_rule_triggers(self, violating_ifc_path: str):
        with open(violating_ifc_path, "rb") as f:
            resp = client.post(
                "/api/v1/ifc/audit",
                files={"file": ("violating.ifc", f, "application/octet-stream")},
                data={
                    "parcel_id": "PARCEL-STOREY",
                    "max_permitted_floors": 5,
                },
            )
        cert = resp.json()
        storey_rule = next(
            r for r in cert["rules_breakdown"]
            if r["rule_id"] == "RULE_A_STOREY_LIMIT"
        )
        assert storey_rule["passed"] is False
        assert storey_rule["detected_values"]["detected_storeys"] == 8
        assert len(storey_rule["violations"]) == 3  # 8 - 5 excess storeys

    def test_column_dimension_rule_triggers(self, violating_ifc_path: str):
        with open(violating_ifc_path, "rb") as f:
            resp = client.post(
                "/api/v1/ifc/audit",
                files={"file": ("violating.ifc", f, "application/octet-stream")},
                data={
                    "parcel_id": "PARCEL-COL",
                    "max_permitted_floors": 5,
                    "min_column_dim_mm": 200.0,
                },
            )
        cert = resp.json()
        col_rule = next(
            r for r in cert["rules_breakdown"]
            if r["rule_id"] == "RULE_B_COLUMN_DIMENSION"
        )
        assert col_rule["passed"] is False
        # Every column is 150 mm — all should be flagged
        assert len(col_rule["violations"]) > 0

    def test_egress_rule_triggers(self, violating_ifc_path: str):
        with open(violating_ifc_path, "rb") as f:
            resp = client.post(
                "/api/v1/ifc/audit",
                files={"file": ("violating.ifc", f, "application/octet-stream")},
                data={
                    "parcel_id": "PARCEL-EGRESS",
                    "max_permitted_floors": 5,
                },
            )
        cert = resp.json()
        egress_rule = next(
            r for r in cert["rules_breakdown"]
            if r["rule_id"] == "RULE_C_EGRESS_SAFETY"
        )
        assert egress_rule["passed"] is False
        assert egress_rule["detected_values"]["storeys_missing_stairs"] >= 3


# ──────────────────────────────────────────────────────────────────────
# Edge cases
# ──────────────────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_empty_file_returns_422(self):
        resp = client.post(
            "/api/v1/ifc/audit",
            files={"file": ("empty.ifc", b"", "application/octet-stream")},
            data={
                "parcel_id": "PARCEL-EMPTY",
                "max_permitted_floors": 5,
            },
        )
        assert resp.status_code == 422

    def test_sha256_is_deterministic(self, compliant_ifc_path: str):
        """Two uploads of the same file must produce identical hashes."""
        hashes = []
        for _ in range(2):
            with open(compliant_ifc_path, "rb") as f:
                resp = client.post(
                    "/api/v1/ifc/audit",
                    files={"file": ("c.ifc", f, "application/octet-stream")},
                    data={"parcel_id": "DET", "max_permitted_floors": 5},
                )
            hashes.append(resp.json()["file_sha256"])
        assert hashes[0] == hashes[1]
