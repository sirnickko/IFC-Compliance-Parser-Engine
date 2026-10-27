"""
IFC Plan Ingestion & Provenance Service.

``IFCAuditor`` is the primary façade for loading an IFC file from raw
bytes, computing its immutable SHA-256 fingerprint, extracting project
metadata, and resolving the spatial storey hierarchy.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from typing import Optional

import ifcopenshell

from schemas.compliance import BuildingMetadata, StoreyInfo


class IFCAuditor:
    """
    Stateful auditor bound to a single uploaded IFC file.

    Parameters
    ----------
    file_bytes:
        Raw bytes of the uploaded ``.ifc`` file.
    """

    def __init__(self, file_bytes: bytes) -> None:
        self.file_bytes = file_bytes
        self.file_hash: str = self._compute_hash()
        self.model: ifcopenshell.file = self._load_model()
        self.unit_to_mm: float = self._get_length_unit_to_mm()

    # ------------------------------------------------------------------
    # Provenance
    # ------------------------------------------------------------------

    def _compute_hash(self) -> str:
        """Deterministic SHA-256 fingerprint of the raw IFC byte stream."""
        return hashlib.sha256(self.file_bytes).hexdigest()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _load_model(self) -> ifcopenshell.file:
        """Write bytes to a temp file and open with ifcopenshell."""
        fd, path = tempfile.mkstemp(suffix=".ifc")
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(self.file_bytes)
            model = ifcopenshell.open(path)
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass
        return model

    # ------------------------------------------------------------------
    # Unit detection
    # ------------------------------------------------------------------

    def _get_length_unit_to_mm(self) -> float:
        """
        Return the factor that converts the model's native length unit
        to millimetres.

        Handles IfcSIUnit with Prefix (MILLI, CENTI, or bare METRE)
        and IfcConversionBasedUnit for imperial models.
        """
        try:
            for assignment in self.model.by_type("IfcUnitAssignment"):
                for unit in assignment.Units:
                    if getattr(unit, "UnitType", None) != "LENGTHUNIT":
                        continue
                    # IfcSIUnit
                    if unit.is_a("IfcSIUnit"):
                        prefix = getattr(unit, "Prefix", None)
                        if prefix == "MILLI":
                            return 1.0
                        if prefix == "CENTI":
                            return 10.0
                        # No prefix → base SI metre
                        return 1000.0
                    # IfcConversionBasedUnit (feet, inches, …)
                    if unit.is_a("IfcConversionBasedUnit"):
                        factor = unit.ConversionFactor
                        if factor and factor.ValueComponent:
                            return float(factor.ValueComponent.wrappedValue) * 1000.0
        except Exception:
            pass
        # Fallback: assume millimetres
        return 1.0

    # ------------------------------------------------------------------
    # Metadata extraction
    # ------------------------------------------------------------------

    def get_storeys(self) -> list[StoreyInfo]:
        """Extract and sort all ``IfcBuildingStorey`` instances by elevation."""
        storeys = self.model.by_type("IfcBuildingStorey")
        infos: list[StoreyInfo] = []
        for s in storeys:
            elev_native = s.Elevation if s.Elevation is not None else 0.0
            elev_m = elev_native * self.unit_to_mm / 1000.0
            infos.append(
                StoreyInfo(
                    name=s.Name or "Unnamed",
                    global_id=s.GlobalId,
                    elevation_m=round(elev_m, 4),
                )
            )
        infos.sort(key=lambda si: si.elevation_m)
        return infos

    def get_total_height(self) -> Optional[float]:
        """
        Compute total building height in metres.

        Prefers roof elements (``IfcRoof``) for the top bound; falls back
        to extrapolating from storey elevations.
        """
        storeys = self.model.by_type("IfcBuildingStorey")
        if not storeys:
            return None

        elevations = [
            s.Elevation for s in storeys if s.Elevation is not None
        ]
        if not elevations:
            return None

        min_elev = min(elevations)
        max_elev = max(elevations)

        # Try to use IfcRoof Z coordinate as the real top
        roof_z: Optional[float] = None
        for roof in self.model.by_type("IfcRoof"):
            z = self._element_z(roof)
            if z is not None and (roof_z is None or z > roof_z):
                roof_z = z

        if roof_z is not None and roof_z > max_elev:
            height_native = roof_z - min_elev
        elif len(elevations) > 1:
            sorted_elev = sorted(elevations)
            avg_floor_height = (sorted_elev[-1] - sorted_elev[0]) / (
                len(sorted_elev) - 1
            )
            height_native = max_elev - min_elev + avg_floor_height
        else:
            height_native = 0.0

        return round(height_native * self.unit_to_mm / 1000.0, 4)

    @staticmethod
    def _element_z(element) -> Optional[float]:
        """Read the Z coordinate from an element's placement, if present."""
        placement = element.ObjectPlacement
        if placement is None:
            return None
        rel = getattr(placement, "RelativePlacement", None)
        if rel is None:
            return None
        loc = getattr(rel, "Location", None)
        if loc is None:
            return None
        coords = list(loc.Coordinates)
        return coords[2] if len(coords) > 2 else None

    def get_metadata(self) -> BuildingMetadata:
        """Aggregate project header data and storey hierarchy."""
        # Schema version
        schema_version: Optional[str] = getattr(self.model, "schema", None)

        # IfcProject
        projects = self.model.by_type("IfcProject")
        project_name: Optional[str] = (
            projects[0].Name if projects else None
        )

        # Header metadata
        creation_timestamp: Optional[str] = None
        authoring_app: Optional[str] = None
        try:
            header = self.model.header
            fn = header.file_name
            if fn:
                creation_timestamp = getattr(fn, "time_stamp", None)
                authoring_app = getattr(fn, "originating_system", None)
                if not authoring_app:
                    authoring_app = getattr(fn, "preprocessor_version", None)
        except Exception:
            pass

        storey_infos = self.get_storeys()
        total_height = self.get_total_height()

        return BuildingMetadata(
            project_name=project_name,
            schema_version=schema_version,
            creation_timestamp=creation_timestamp,
            authoring_application=authoring_app,
            total_storeys=len(storey_infos),
            storeys=storey_infos,
            total_building_height_m=total_height,
        )
