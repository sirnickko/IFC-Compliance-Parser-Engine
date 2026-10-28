import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.ifc_auditor import IFCAuditor
from backend.app.models.schemas import OverallStatus, Severity
from backend.tests.generate_synthetic_ifc import (
    generate_compliant_building,
    generate_violating_building,
)

client = TestClient(app)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(scope="session", autouse=True)
def ensure_fixtures():
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    comp = FIXTURES_DIR / "compliant_building.ifc"
    viol = FIXTURES_DIR / "violating_building.ifc"
    if not comp.exists():
        generate_compliant_building(str(comp))
    if not viol.exists():
        generate_violating_building(str(viol))


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "ifcopenshell_version" in data


def test_compliant_building_audit():
    comp_path = FIXTURES_DIR / "compliant_building.ifc"
    with open(comp_path, "rb") as f:
        file_bytes = f.read()

    auditor = IFCAuditor(file_bytes)
    result = auditor.audit(
        parcel_id="MUNI-PARCEL-100",
        max_permitted_floors=4,
        min_column_dim_mm=200.0,
    )

    assert result.overall_status == OverallStatus.APPROVED
    assert len(result.file_sha256) == 64
    assert result.summary.critical_count == 0
    assert result.summary.warning_count == 0
    assert result.metadata.total_storeys == 4
    assert len(result.elements_3d) > 0


def test_violating_building_audit():
    viol_path = FIXTURES_DIR / "violating_building.ifc"
    with open(viol_path, "rb") as f:
        file_bytes = f.read()

    auditor = IFCAuditor(file_bytes)
    result = auditor.audit(
        parcel_id="ILLEGAL-PARCEL-999",
        max_permitted_floors=4,
        min_column_dim_mm=200.0,
    )

    assert result.overall_status == OverallStatus.REJECTED
    assert result.summary.critical_count > 0

    finding_ids = [f.id for f in result.findings]
    assert "ERR_STOREY_EXCEEDED" in finding_ids
    assert "ERR_UNDERSIZED_COLUMN" in finding_ids
    assert "ERR_MISSING_VERTICAL_EGRESS" in finding_ids
    assert "ERR_DISCONTINUOUS_COLUMN_LOADPATH" in finding_ids

    # Verify structural risk and recommendation are detailed
    for finding in result.findings:
        assert finding.structural_risk
        assert finding.recommendation
        assert finding.details


def test_api_audit_endpoint_multipart():
    viol_path = FIXTURES_DIR / "violating_building.ifc"
    with open(viol_path, "rb") as f:
        response = client.post(
            "/api/v1/plans/audit",
            data={
                "parcel_id": "TEST-PARCEL-2026",
                "max_permitted_floors": 4,
                "min_column_dim_mm": 200.0,
            },
            files={"file": ("violating_building.ifc", f, "application/octet-stream")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] == "REJECTED"
    assert len(data["findings"]) >= 4
    assert "elements_3d" in data
    assert len(data["elements_3d"]) > 0


def test_api_sample_endpoints():
    # Test sample audit for compliant
    res_comp = client.get("/api/v1/plans/sample-audit/compliant")
    assert res_comp.status_code == 200
    assert res_comp.json()["overall_status"] == "APPROVED"

    # Test sample audit for violating
    res_viol = client.get("/api/v1/plans/sample-audit/violating")
    assert res_viol.status_code == 200
    assert res_viol.json()["overall_status"] == "REJECTED"


def test_sha256_fingerprint_deterministic():
    comp_path = FIXTURES_DIR / "compliant_building.ifc"
    with open(comp_path, "rb") as f:
        file_bytes = f.read()

    auditor1 = IFCAuditor(file_bytes)
    auditor2 = IFCAuditor(file_bytes)
    assert auditor1.file_sha256 == auditor2.file_sha256
