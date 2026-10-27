"""
Unit tests for the IFCAuditor (services/ifc_parser.py).

Validates SHA-256 hashing, metadata extraction, storey hierarchy
parsing, and total height computation.
"""

from __future__ import annotations

import hashlib

import pytest

from services.ifc_parser import IFCAuditor


class TestIFCAuditorCompliant:
    """Tests against the compliant 4-storey fixture."""

    @pytest.fixture(autouse=True)
    def _setup(self, compliant_bytes: bytes):
        self.auditor = IFCAuditor(compliant_bytes)
        self.raw = compliant_bytes

    def test_sha256_matches_raw_bytes(self):
        expected = hashlib.sha256(self.raw).hexdigest()
        assert self.auditor.file_hash == expected

    def test_sha256_is_deterministic(self):
        auditor2 = IFCAuditor(self.raw)
        assert auditor2.file_hash == self.auditor.file_hash

    def test_schema_version(self):
        meta = self.auditor.get_metadata()
        assert meta.schema_version in ("IFC4", "IFC2X3", "IFC4X3")

    def test_project_name(self):
        meta = self.auditor.get_metadata()
        assert meta.project_name == "Compliant Residential Tower"

    def test_storey_count(self):
        meta = self.auditor.get_metadata()
        assert meta.total_storeys == 4

    def test_storey_elevations_sorted(self):
        storeys = self.auditor.get_storeys()
        elevations = [s.elevation_m for s in storeys]
        assert elevations == sorted(elevations)

    def test_total_height_positive(self):
        meta = self.auditor.get_metadata()
        assert meta.total_building_height_m is not None
        assert meta.total_building_height_m > 0

    def test_unit_to_mm_detected(self):
        # Generator uses MILLIMETRE → factor should be 1.0
        assert self.auditor.unit_to_mm == pytest.approx(1.0)


class TestIFCAuditorViolating:
    """Tests against the violating 8-storey fixture."""

    @pytest.fixture(autouse=True)
    def _setup(self, violating_bytes: bytes):
        self.auditor = IFCAuditor(violating_bytes)

    def test_storey_count(self):
        meta = self.auditor.get_metadata()
        assert meta.total_storeys == 8

    def test_project_name(self):
        meta = self.auditor.get_metadata()
        assert meta.project_name == "Violating Residential Tower"

    def test_hash_differs_from_compliant(self, compliant_bytes: bytes):
        compliant_auditor = IFCAuditor(compliant_bytes)
        assert self.auditor.file_hash != compliant_auditor.file_hash
