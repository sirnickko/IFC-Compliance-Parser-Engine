from __future__ import annotations

import os

import pytest

from tests.synthetic_ifc_generator import (
    generate_compliant_building,
    generate_violating_building,
)

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


@pytest.fixture(scope="session")
def fixture_dir() -> str:
    """Ensure the fixture directory exists and return its path."""
    os.makedirs(FIXTURE_DIR, exist_ok=True)
    return FIXTURE_DIR


@pytest.fixture(scope="session")
def compliant_ifc_path(fixture_dir: str) -> str:
    """Generate (or reuse) the compliant 4-storey IFC fixture."""
    path = os.path.join(fixture_dir, "compliant_building.ifc")
    if not os.path.exists(path):
        generate_compliant_building(path)
    return path


@pytest.fixture(scope="session")
def violating_ifc_path(fixture_dir: str) -> str:
    """Generate (or reuse) the violating 8-storey IFC fixture."""
    path = os.path.join(fixture_dir, "violating_building.ifc")
    if not os.path.exists(path):
        generate_violating_building(path)
    return path


@pytest.fixture(scope="session")
def compliant_bytes(compliant_ifc_path: str) -> bytes:
    """Raw bytes of the compliant IFC file."""
    with open(compliant_ifc_path, "rb") as f:
        return f.read()


@pytest.fixture(scope="session")
def violating_bytes(violating_ifc_path: str) -> bytes:
    """Raw bytes of the violating IFC file."""
    with open(violating_ifc_path, "rb") as f:
        return f.read()
