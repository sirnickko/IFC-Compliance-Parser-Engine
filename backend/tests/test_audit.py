import os
from pathlib import Path
import ifcopenshell
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
        parcel_id="DEMO-PARCEL-001",
        max_permitted_floors=4,
        min_column_dim_mm=200.0,
    )

    assert result.overall_status == OverallStatus.FLAGGED_FOR_REVIEW
    assert any(check.status.value == "Could not check" for check in result.checks)
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
        parcel_id="DEMO-PARCEL-001",
        max_permitted_floors=4,
        min_column_dim_mm=200.0,
    )

    assert result.overall_status == OverallStatus.REJECTED
    assert result.summary.critical_count > 0

    finding_ids = [f.id for f in result.findings]
    assert "ERR_STOREY_EXCEEDED" in finding_ids
    assert "ERR_UNDERSIZED_COLUMN" not in finding_ids
    assert "ERR_MISSING_VERTICAL_EGRESS" in finding_ids
    assert "ERR_DISCONTINUOUS_COLUMN_LOADPATH" in finding_ids
    assert all(f.status == "needs_review" for f in result.findings)
    assert all(f.clause_reference is None for f in result.findings)

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
                "parcel_id": "DEMO-PARCEL-001",
                "max_permitted_floors": 4,
                "min_column_dim_mm": 200.0,
            },
            files={"file": ("violating_building.ifc", f, "application/octet-stream")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] == "REJECTED"
    assert len(data["findings"]) >= 3
    assert "elements_3d" in data
    assert len(data["elements_3d"]) > 0


def test_api_sample_endpoints():
    # Test sample audit for compliant
    res_comp = client.get("/api/v1/plans/sample-audit/compliant")
    assert res_comp.status_code == 200
    assert res_comp.json()["overall_status"] == "FLAGGED_FOR_REVIEW"

    # Test sample audit for violating
    res_viol = client.get("/api/v1/plans/sample-audit/violating")
    assert res_viol.status_code == 200
    assert res_viol.json()["overall_status"] == "REJECTED"


def test_mock_parcel_endpoint_labels_records_as_mock():
    response = client.get("/api/v1/parcels")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 9
    assert all(feature["properties"]["source"] == "MOCK DEMO DATA" for feature in data["features"])
    assert all(feature["properties"]["lr_number"].startswith("DEMO-LR-") for feature in data["features"])


def test_sha256_fingerprint_deterministic():
    comp_path = FIXTURES_DIR / "compliant_building.ifc"
    with open(comp_path, "rb") as f:
        file_bytes = f.read()

    auditor1 = IFCAuditor(file_bytes)
    auditor2 = IFCAuditor(file_bytes)
    assert auditor1.file_sha256 == auditor2.file_sha256


def test_incomplete_ifc_checks_are_not_silently_passed():
    model = ifcopenshell.file(schema="IFC4")
    result = IFCAuditor(model.to_string().encode("utf-8")).audit(
        parcel_id="DEMO-PARCEL-001",
        max_permitted_floors=4,
    )
    assert result.overall_status == OverallStatus.FLAGGED_FOR_REVIEW
    assert all(check.status.value == "Could not check" for check in result.checks)


def test_compare_endpoint_reports_storey_and_column_differences():
    with open(FIXTURES_DIR / "compliant_building.ifc", "rb") as approved, open(
        FIXTURES_DIR / "violating_building.ifc", "rb"
    ) as current:
        response = client.post(
            "/api/v1/plans/compare",
            files={
                "approved_file": ("approved.ifc", approved, "application/octet-stream"),
                "current_file": ("current.ifc", current, "application/octet-stream"),
            },
        )
    assert response.status_code == 200
    diff = response.json()
    assert len(diff["storeys_added"]) == 4
    assert diff["columns_added"]
    assert diff["columns_removed"]
    assert diff["added_elements"]
    assert diff["removed_elements"]
    assert diff["height_change_m"] == 12.0
    assert diff["statuses"]["footprint"] == "Could not check"


def test_compare_endpoint_reports_identical_models_as_unchanged():
    with open(FIXTURES_DIR / "compliant_building.ifc", "rb") as approved, open(
        FIXTURES_DIR / "compliant_building.ifc", "rb"
    ) as current:
        response = client.post(
            "/api/v1/plans/compare",
            files={
                "approved_file": ("approved.ifc", approved, "application/octet-stream"),
                "current_file": ("current.ifc", current, "application/octet-stream"),
            },
        )
    assert response.status_code == 200
    diff = response.json()
    assert diff["storeys_added"] == []
    assert diff["storeys_removed"] == []
    assert diff["columns_added"] == []
    assert diff["columns_removed"] == []
    assert diff["columns_changed"] == []


def test_compare_endpoint_detects_changed_column_section():
    source = (FIXTURES_DIR / "compliant_building.ifc").read_text(encoding="utf-8")
    model = ifcopenshell.file.from_string(source)
    column = model.by_type("IfcColumn")[0]
    solid = next(
        item
        for representation in column.Representation.Representations
        for item in representation.Items
        if getattr(item, "SweptArea", None) is not None
    )
    solid.SweptArea.XDim = 400.0
    updated = model.to_string().encode("utf-8")
    original = source.encode("utf-8")
    response = client.post(
        "/api/v1/plans/compare",
        files={
            "approved_file": ("approved.ifc", original, "application/octet-stream"),
            "current_file": ("current.ifc", updated, "application/octet-stream"),
        },
    )
    assert response.status_code == 200
    diff = response.json()
    assert len(diff["columns_changed"]) == 1
    assert diff["columns_changed"][0]["approved_section_mm"] == [300.0, 300.0]
    assert diff["columns_changed"][0]["current_section_mm"] == [400.0, 300.0]


def test_compare_endpoint_rejects_malformed_ifc():
    response = client.post(
        "/api/v1/plans/compare",
        files={
            "approved_file": ("bad.ifc", b"not an IFC model", "application/octet-stream"),
            "current_file": ("also-bad.ifc", b"not an IFC model", "application/octet-stream"),
        },
    )
    assert response.status_code == 422


def test_upload_size_limit_returns_payload_too_large(monkeypatch):
    import backend.app.api.routes as routes

    monkeypatch.setattr(routes, "MAX_IFC_BYTES", 4)
    response = client.post(
        "/api/v1/plans/audit",
        data={"parcel_id": "DEMO-PARCEL-001"},
        files={"file": ("sample.ifc", b"ISO-10303-21;", "application/octet-stream")},
    )
    assert response.status_code == 413
