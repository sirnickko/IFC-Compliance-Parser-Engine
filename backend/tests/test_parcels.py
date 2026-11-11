import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.parcel_store import validate_polygon_geometry
from backend.tests.generate_synthetic_ifc import generate_compliant_building


@pytest.fixture
def parcel_client(tmp_path, monkeypatch):
    monkeypatch.setenv("SITEBETA_DB_PATH", str(tmp_path / "parcels.sqlite3"))
    return TestClient(app)


def test_parcels_geojson_and_bbox_filter(parcel_client):
    response = parcel_client.get("/api/parcels")
    assert response.status_code == 200
    collection = response.json()
    assert collection["type"] == "FeatureCollection"
    assert len(collection["features"]) == 9
    assert all(feature["properties"]["source"] == "MOCK DEMO DATA" for feature in collection["features"])
    assert all(feature["properties"]["audit_status"] == "unchecked" for feature in collection["features"])
    assert all(feature["properties"]["violation_count"] == 0 for feature in collection["features"])

    feature = collection["features"][0]
    points = feature["geometry"]["coordinates"][0]
    longitude = sum(point[0] for point in points[:-1]) / (len(points) - 1)
    latitude = sum(point[1] for point in points[:-1]) / (len(points) - 1)
    bbox = f"{longitude - 0.0001},{latitude - 0.0001},{longitude + 0.0001},{latitude + 0.0001}"
    filtered = parcel_client.get("/api/parcels", params={"bbox": bbox})
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["features"]] == [feature["id"]]


@pytest.mark.parametrize(
    "bbox",
    ["1,2,3", "200,0,201,1", "2,3,1,4", "0,91,1,92", "nan,0,1,1"],
)
def test_invalid_bbox_returns_clear_error(parcel_client, bbox):
    response = parcel_client.get("/api/parcels", params={"bbox": bbox})
    assert response.status_code == 400
    assert "bbox" in response.json()["detail"]


def test_parcel_detail_has_empty_audit_history(parcel_client):
    response = parcel_client.get("/api/parcels/DEMO-PARCEL-001")
    assert response.status_code == 200
    detail = response.json()
    assert detail["properties"]["lr_number"] == "DEMO-LR-001"
    assert detail["audit_history"] == []


@pytest.mark.parametrize(
    ("geometry", "message"),
    [
        ({"type": "Point", "coordinates": [36.8, -1.2]}, "GeoJSON Polygon"),
        ({"type": "Polygon", "coordinates": [[[36.8, -1.2], [36.9, -1.2], [36.9, -1.1]]]}, "at least four"),
        ({"type": "Polygon", "coordinates": [[[36.8, -1.2], [36.9, -1.2], [36.9, -1.1], [36.85, -1.15]]]}, "closed"),
        ({"type": "Polygon", "coordinates": [[[float("nan"), 0], [1, 0], [1, 1], [float("nan"), 0]]]}, "numeric longitude"),
    ],
)
def test_invalid_polygon_geometry_is_rejected(geometry, message):
    with pytest.raises(ValueError, match=message):
        validate_polygon_geometry(geometry)


def test_oversized_polygon_geometry_is_rejected():
    ring = [[0, 0], [1, 0], [1, 1], [0, 0]] * 5000
    geometry = {"type": "Polygon", "coordinates": [ring]}
    with pytest.raises(ValueError, match="64 KiB"):
        validate_polygon_geometry(geometry)


def test_self_intersecting_polygon_is_rejected():
    geometry = {
        "type": "Polygon",
        "coordinates": [[[0, 0], [2, 2], [0, 2], [2, 0], [1, 0], [0, 0]]],
    }
    with pytest.raises(ValueError, match="self-intersect"):
        validate_polygon_geometry(geometry)


def test_polygon_hole_must_be_contained_by_exterior_ring():
    geometry = {
        "type": "Polygon",
        "coordinates": [
            [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
            [[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]],
        ],
    }
    with pytest.raises(ValueError, match="contained"):
        validate_polygon_geometry(geometry)


def test_link_audit_to_parcel_and_read_history(parcel_client, tmp_path):
    sample_path = tmp_path / "compliant.ifc"
    generate_compliant_building(str(sample_path))
    with sample_path.open("rb") as sample_file:
        audit_response = parcel_client.post(
            "/api/v1/plans/audit",
            data={"parcel_id": "DEMO-PARCEL-001"},
            files={"file": ("sample.ifc", sample_file, "application/octet-stream")},
        )
    assert audit_response.status_code == 200
    audit = audit_response.json()

    link_response = parcel_client.post(
        "/api/parcels/DEMO-PARCEL-001/link-audit",
        json={"audit_id": audit["audit_id"]},
    )
    assert link_response.status_code == 200
    assert link_response.json()["audit_id"] == audit["audit_id"]

    detail_response = parcel_client.get("/api/parcels/DEMO-PARCEL-001")
    assert detail_response.status_code == 200
    history = detail_response.json()["audit_history"]
    assert len(history) == 1
    assert history[0]["audit_result"]["audit_id"] == audit["audit_id"]


def test_link_unknown_audit_returns_not_found(parcel_client):
    response = parcel_client.post(
        "/api/parcels/DEMO-PARCEL-001/link-audit",
        json={"audit_id": "missing-audit"},
    )
    assert response.status_code == 404
    assert "Audit result was not found" in response.json()["detail"]


def test_unknown_parcel_returns_not_found(parcel_client):
    response = parcel_client.get("/api/parcels/does-not-exist")
    assert response.status_code == 404
