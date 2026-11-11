from __future__ import annotations

import json
import math
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

from ..models.schemas import AuditResponse, CheckStatusValue, OverallStatus, Severity

ROOT_DIR = Path(__file__).resolve().parents[3]
SEED_FILE = ROOT_DIR / "mock_parcels.json"
MAX_GEOMETRY_BYTES = 64 * 1024
MAX_RING_VERTICES = 2000
MAP_STATUSES = {"compliant", "non-compliant", "could_not_check", "unchecked"}


def _database_path() -> Path:
    return Path(os.getenv("SITEBETA_DB_PATH", str(ROOT_DIR / "data" / "sitebeta.sqlite3")))


def _orientation(a: list[float], b: list[float], c: list[float]) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _segments_intersect(a: list[float], b: list[float], c: list[float], d: list[float]) -> bool:
    o1 = _orientation(a, b, c)
    o2 = _orientation(a, b, d)
    o3 = _orientation(c, d, a)
    o4 = _orientation(c, d, b)

    def on_segment(start: list[float], point: list[float], end: list[float]) -> bool:
        return (
            min(start[0], end[0]) <= point[0] <= max(start[0], end[0])
            and min(start[1], end[1]) <= point[1] <= max(start[1], end[1])
        )

    if o1 * o2 < 0 and o3 * o4 < 0:
        return True
    return (
        (o1 == 0 and on_segment(a, c, b))
        or (o2 == 0 and on_segment(a, d, b))
        or (o3 == 0 and on_segment(c, a, d))
        or (o4 == 0 and on_segment(c, b, d))
    )


def _point_in_ring(point: list[float], ring: list[list[float]]) -> bool:
    longitude, latitude = point
    inside = False
    for index in range(len(ring) - 1):
        x1, y1 = ring[index]
        x2, y2 = ring[index + 1]
        if (y1 > latitude) != (y2 > latitude):
            crossing_longitude = (x2 - x1) * (latitude - y1) / (y2 - y1) + x1
            if longitude < crossing_longitude:
                inside = not inside
    return inside


def validate_polygon_geometry(geometry: object) -> dict:
    if not isinstance(geometry, dict) or geometry.get("type") != "Polygon":
        raise ValueError("Parcel geometry must be a GeoJSON Polygon.")
    if len(json.dumps(geometry, separators=(",", ":")).encode("utf-8")) > MAX_GEOMETRY_BYTES:
        raise ValueError(f"Parcel geometry exceeds the {MAX_GEOMETRY_BYTES // 1024} KiB limit.")
    rings = geometry.get("coordinates")
    if not isinstance(rings, list) or not rings:
        raise ValueError("Polygon coordinates must contain an exterior linear ring.")
    validated_rings: list[list[list[float]]] = []
    total_vertices = 0
    for ring_index, ring in enumerate(rings):
        if not isinstance(ring, list) or len(ring) < 4:
            raise ValueError("Each polygon ring must contain at least four positions.")
        if len(ring) > MAX_RING_VERTICES:
            raise ValueError(f"Polygon rings may contain at most {MAX_RING_VERTICES} positions.")
        clean_ring = []
        for position in ring:
            if (
                not isinstance(position, (list, tuple))
                or len(position) < 2
                or not all(
                    isinstance(value, (int, float))
                    and not isinstance(value, bool)
                    and math.isfinite(value)
                    for value in position[:2]
                )
            ):
                raise ValueError("Every GeoJSON position must contain numeric longitude and latitude.")
            longitude, latitude = float(position[0]), float(position[1])
            if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
                raise ValueError("GeoJSON coordinates must use WGS84 longitude/latitude ranges.")
            clean_ring.append([longitude, latitude])
        if clean_ring[0] != clean_ring[-1]:
            raise ValueError("Every polygon ring must be closed (first and last positions must match).")
        if len(set((point[0], point[1]) for point in clean_ring[:-1])) < 3:
            raise ValueError("Each polygon ring must contain at least three distinct positions.")
        if abs(sum(
            clean_ring[index][0] * clean_ring[index + 1][1]
            - clean_ring[index + 1][0] * clean_ring[index][1]
            for index in range(len(clean_ring) - 1)
        )) < 1e-12:
            raise ValueError("Polygon ring area must be greater than zero.")
        edge_count = len(clean_ring) - 1
        for left in range(edge_count):
            for right in range(left + 1, edge_count):
                if right in {left, left + 1} or (left == 0 and right == edge_count - 1):
                    continue
                if _segments_intersect(
                    clean_ring[left], clean_ring[left + 1],
                    clean_ring[right], clean_ring[right + 1],
                ):
                    raise ValueError("Polygon rings must not self-intersect.")
        total_vertices += len(clean_ring)
        if total_vertices > MAX_RING_VERTICES:
            raise ValueError(f"Polygon may contain at most {MAX_RING_VERTICES} positions total.")
        validated_rings.append(clean_ring)
    exterior = validated_rings[0]
    for hole_index, hole in enumerate(validated_rings[1:], start=1):
        if not _point_in_ring(hole[0], exterior):
            raise ValueError("Polygon interior rings must be contained by the exterior ring.")
        for left in range(len(exterior) - 1):
            for right in range(len(hole) - 1):
                if _segments_intersect(
                    exterior[left], exterior[left + 1], hole[right], hole[right + 1]
                ):
                    raise ValueError("Polygon interior rings must not intersect the exterior ring.")
        for other_hole in validated_rings[1:hole_index]:
            if _point_in_ring(hole[0], other_hole) or _point_in_ring(other_hole[0], hole):
                raise ValueError("Polygon interior rings must not overlap.")
            for left in range(len(other_hole) - 1):
                for right in range(len(hole) - 1):
                    if _segments_intersect(
                        other_hole[left], other_hole[left + 1], hole[right], hole[right + 1]
                    ):
                        raise ValueError("Polygon interior rings must not overlap.")
    return {"type": "Polygon", "coordinates": validated_rings}


@contextmanager
def _connection() -> Iterator[sqlite3.Connection]:
    path = _database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_database() -> None:
    with _connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS parcels (
                id TEXT PRIMARY KEY,
                lr_number TEXT NOT NULL UNIQUE,
                county TEXT NOT NULL,
                zone TEXT NOT NULL,
                permitted_storeys INTEGER NOT NULL CHECK (permitted_storeys > 0),
                geometry_json TEXT NOT NULL,
                source TEXT NOT NULL,
                last_updated TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_results (
                id TEXT PRIMARY KEY,
                model_hash TEXT NOT NULL,
                audit_json TEXT NOT NULL,
                audited_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                parcel_id TEXT NOT NULL REFERENCES parcels(id),
                audit_id TEXT NOT NULL UNIQUE REFERENCES audit_results(id),
                audit_status TEXT NOT NULL CHECK (audit_status IN ('compliant', 'non-compliant', 'could_not_check', 'unchecked')),
                violation_count INTEGER NOT NULL CHECK (violation_count >= 0),
                highest_severity TEXT,
                audited_at TEXT NOT NULL,
                model_hash TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS submissions_parcel_audited
                ON submissions(parcel_id, audited_at DESC);
            """
        )
        if connection.execute("SELECT COUNT(*) FROM parcels").fetchone()[0] == 0:
            with open(SEED_FILE, "r", encoding="utf-8") as seed_file:
                seed_records = json.load(seed_file)["mock_parcels"]
            for record in seed_records:
                geometry = validate_polygon_geometry(record["geometry"])
                if record.get("source") != "MOCK DEMO DATA":
                    raise ValueError("Every seeded demo parcel must use source 'MOCK DEMO DATA'.")
                connection.execute(
                    """
                    INSERT INTO parcels (id, lr_number, county, zone, permitted_storeys,
                                         geometry_json, source, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["id"], record["lr_number"], record["county"], record["zone"],
                        record["permitted_storeys"], json.dumps(geometry),
                        record["source"], record["last_updated"],
                    ),
                )


def _parcel_query(connection: sqlite3.Connection) -> list[sqlite3.Row]:
    return connection.execute(
        """
        SELECT p.*,
               s.audit_status, s.violation_count, s.highest_severity,
               s.audited_at, s.model_hash, s.audit_id,
               a.audit_json
        FROM parcels p
        LEFT JOIN submissions s ON s.id = (
            SELECT s2.id FROM submissions s2
            WHERE s2.parcel_id = p.id ORDER BY s2.audited_at DESC LIMIT 1
        )
        LEFT JOIN audit_results a ON a.id = s.audit_id
        """
    ).fetchall()


def _parcel_feature(row: sqlite3.Row) -> dict:
    audit_json = json.loads(row["audit_json"]) if row["audit_json"] else None
    unverified = bool(
        audit_json and any(finding.get("status") == "needs_review" for finding in audit_json.get("findings", []))
    )
    return {
        "type": "Feature",
        "id": row["id"],
        "geometry": validate_polygon_geometry(json.loads(row["geometry_json"])),
        "properties": {
            "id": row["id"],
            "lr_number": row["lr_number"],
            "county": row["county"],
            "zone": row["zone"],
            "permitted_storeys": row["permitted_storeys"],
            "source": row["source"],
            "last_updated": row["last_updated"],
            "audit_status": row["audit_status"] or "unchecked",
            "violation_count": row["violation_count"] or 0,
            "highest_severity": row["highest_severity"],
            "audited_at": row["audited_at"],
            "model_hash": row["model_hash"],
            "audit_id": row["audit_id"],
            "has_unverified_rules": unverified,
        },
    }


def _bbox_values(bbox: Optional[str]) -> Optional[tuple[float, float, float, float]]:
    if bbox is None:
        return None
    try:
        values = tuple(float(part) for part in bbox.split(","))
    except ValueError as exc:
        raise ValueError("bbox must contain four numeric values: west,south,east,north.") from exc
    if len(values) != 4:
        raise ValueError("bbox must contain four numeric values: west,south,east,north.")
    west, south, east, north = values
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("bbox must be a valid WGS84 extent: west < east and south < north.")
    return west, south, east, north


def list_parcel_features(bbox: Optional[str] = None) -> dict:
    initialize_database()
    bounds = _bbox_values(bbox)
    features = []
    with _connection() as connection:
        for row in _parcel_query(connection):
            feature = _parcel_feature(row)
            if bounds:
                positions = [
                    position
                    for ring in feature["geometry"]["coordinates"]
                    for position in ring
                ]
                min_lon = min(position[0] for position in positions)
                min_lat = min(position[1] for position in positions)
                max_lon = max(position[0] for position in positions)
                max_lat = max(position[1] for position in positions)
                west, south, east, north = bounds
                if max_lon < west or min_lon > east or max_lat < south or min_lat > north:
                    continue
            features.append(feature)
    return {"type": "FeatureCollection", "features": features}


def list_parcel_records() -> list[dict]:
    initialize_database()
    with _connection() as connection:
        rows = connection.execute(
            "SELECT id, lr_number, county, zone, permitted_storeys, source, last_updated FROM parcels ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]


def get_parcel_details(parcel_id: str) -> Optional[dict]:
    initialize_database()
    with _connection() as connection:
        parcel = connection.execute("SELECT * FROM parcels WHERE id = ?", (parcel_id,)).fetchone()
        if parcel is None:
            return None
        history = connection.execute(
            """
            SELECT s.*, a.audit_json FROM submissions s
            JOIN audit_results a ON a.id = s.audit_id
            WHERE s.parcel_id = ? ORDER BY s.audited_at DESC
            """,
            (parcel_id,),
        ).fetchall()
    return {
        "type": "Feature",
        "id": parcel["id"],
        "geometry": validate_polygon_geometry(json.loads(parcel["geometry_json"])),
        "properties": {
            "id": parcel["id"],
            "lr_number": parcel["lr_number"],
            "county": parcel["county"],
            "zone": parcel["zone"],
            "permitted_storeys": parcel["permitted_storeys"],
            "source": parcel["source"],
            "last_updated": parcel["last_updated"],
        },
        "audit_history": [
            {
                "submission_id": item["id"],
                "audit_id": item["audit_id"],
                "audit_status": item["audit_status"],
                "violation_count": item["violation_count"],
                "highest_severity": item["highest_severity"],
                "audited_at": item["audited_at"],
                "model_hash": item["model_hash"],
                "audit_result": json.loads(item["audit_json"]),
            }
            for item in history
        ],
    }


def save_audit_result(result: AuditResponse) -> str:
    initialize_database()
    audit_id = str(uuid.uuid4())
    stored_result = result.model_copy(update={"audit_id": audit_id})
    with _connection() as connection:
        connection.execute(
            "INSERT INTO audit_results (id, model_hash, audit_json, audited_at) VALUES (?, ?, ?, ?)",
            (
                audit_id, result.file_sha256, stored_result.model_dump_json(),
                result.audit_timestamp,
            ),
        )
    return audit_id


def _audit_status(result: AuditResponse) -> tuple[str, Optional[str]]:
    if any(check.status == CheckStatusValue.FAILED for check in result.checks):
        status_value = "non-compliant"
    elif result.overall_status == OverallStatus.REJECTED:
        status_value = "non-compliant"
    elif any(check.status == CheckStatusValue.COULD_NOT_CHECK for check in result.checks):
        status_value = "could_not_check"
    elif any(finding.status == "needs_review" for finding in result.findings):
        status_value = "could_not_check"
    elif result.overall_status == OverallStatus.APPROVED:
        status_value = "compliant"
    else:
        status_value = "could_not_check"
    severity_rank = {Severity.INFO: 0, Severity.WARNING: 1, Severity.CRITICAL: 2}
    highest = max(result.findings, key=lambda finding: severity_rank[finding.severity], default=None)
    return status_value, highest.severity.value if highest else None


def link_audit_to_parcel(parcel_id: str, audit_id: str) -> Optional[dict]:
    initialize_database()
    with _connection() as connection:
        if connection.execute("SELECT 1 FROM parcels WHERE id = ?", (parcel_id,)).fetchone() is None:
            return None
        audit_row = connection.execute(
            "SELECT audit_json FROM audit_results WHERE id = ?", (audit_id,)
        ).fetchone()
        if audit_row is None:
            raise LookupError("Audit result was not found. Run an IFC audit before linking it.")
        audit_result = AuditResponse.model_validate_json(audit_row["audit_json"])
        audit_status, highest_severity = _audit_status(audit_result)
        existing = connection.execute(
            "SELECT id, parcel_id FROM submissions WHERE audit_id = ?", (audit_id,)
        ).fetchone()
        if existing and existing["parcel_id"] != parcel_id:
            raise ValueError("This audit result is already linked to a different parcel.")
        submission_id = existing["id"] if existing else str(uuid.uuid4())
        if not existing:
            connection.execute(
                """
                INSERT INTO submissions
                    (id, parcel_id, audit_id, audit_status, violation_count,
                     highest_severity, audited_at, model_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    submission_id, parcel_id, audit_id, audit_status,
                    len(audit_result.findings), highest_severity,
                    audit_result.audit_timestamp, audit_result.file_sha256,
                ),
            )
    return {
        "submission_id": submission_id,
        "parcel_id": parcel_id,
        "audit_id": audit_id,
        "audit_status": audit_status,
        "violation_count": len(audit_result.findings),
        "highest_severity": highest_severity,
        "audited_at": audit_result.audit_timestamp,
        "model_hash": audit_result.file_sha256,
    }
