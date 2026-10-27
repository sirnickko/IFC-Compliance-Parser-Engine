"""
Synthetic IFC Test Data Generator.

Produces two programmatic IFC4 fixtures using ``ifcopenshell``:

1. **compliant_building.ifc** — a 4-storey building with 300 × 300 mm
   columns on every floor, stair flights connecting all levels, and
   vertically aligned columns.

2. **violating_building.ifc** — an 8-storey building designed to trip
   every compliance rule: exceeds a 5-storey limit, has 150 mm
   undersized columns, missing stairs on upper levels, and a floating
   column introduced at storey 5 with no structural support below.

All models use **millimetres** as the native length unit.
"""

from __future__ import annotations

import os
from typing import Optional

import ifcopenshell
import ifcopenshell.api


# ──────────────────────────────────────────────────────────────────────
# Generic building factory
# ──────────────────────────────────────────────────────────────────────

def _create_building(
    output_path: str,
    *,
    project_name: str,
    num_storeys: int,
    storey_height_mm: float,
    column_dim_mm: float,
    column_positions: list[tuple[float, float]],
    stairs_up_to_storey: int,
    extra_upper_columns: Optional[dict] = None,
) -> str:
    """
    Build a synthetic IFC4 file with configurable storeys, columns, and
    stairs, then write it to *output_path*.

    Parameters
    ----------
    extra_upper_columns:
        ``{"from_storey": int, "positions": [(x, y), …]}`` — inject
        extra columns starting at the given storey index to simulate
        floating / discontinued columns.
    """
    model = ifcopenshell.file(schema="IFC4")

    # ── Project & units ──────────────────────────────────────────────
    project = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcProject",
    )
    project.Name = project_name

    ifcopenshell.api.run(
        "unit.assign_unit", model,
        length={"is_metric": True, "raw": "MILLIMETRE"},
    )

    # ── Geometric representation contexts ────────────────────────────
    ctx3d = ifcopenshell.api.run(
        "context.add_context", model, context_type="Model",
    )
    body_ctx = ifcopenshell.api.run(
        "context.add_context", model,
        context_type="Model",
        context_identifier="Body",
        target_view="MODEL_VIEW",
        parent=ctx3d,
    )

    # ── Spatial hierarchy ────────────────────────────────────────────
    site = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcSite",
    )
    site.Name = "Construction Site"

    building = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcBuilding",
    )
    building.Name = "Block A"

    ifcopenshell.api.run(
        "aggregate.assign_object", model,
        relating_object=project, product=site,
    )
    ifcopenshell.api.run(
        "aggregate.assign_object", model,
        relating_object=site, product=building,
    )

    # ── Storeys ──────────────────────────────────────────────────────
    storeys = []
    for i in range(num_storeys):
        elevation = i * storey_height_mm
        storey = ifcopenshell.api.run(
            "root.create_entity", model, ifc_class="IfcBuildingStorey",
        )
        storey.Name = f"Level {i}"
        storey.Elevation = float(elevation)

        # Storey placement
        pt = model.create_entity(
            "IfcCartesianPoint", Coordinates=[0.0, 0.0, float(elevation)],
        )
        ax = model.create_entity("IfcAxis2Placement3D", Location=pt)
        lp = model.create_entity("IfcLocalPlacement", RelativePlacement=ax)
        storey.ObjectPlacement = lp

        ifcopenshell.api.run(
            "aggregate.assign_object", model,
            relating_object=building, product=storey,
        )
        storeys.append(storey)

    # ── Columns ──────────────────────────────────────────────────────
    extrude_dir = model.create_entity(
        "IfcDirection", DirectionRatios=[0.0, 0.0, 1.0],
    )

    for s_idx, storey in enumerate(storeys):
        positions = list(column_positions)
        # Inject extra floating columns on upper storeys
        if (
            extra_upper_columns
            and s_idx >= extra_upper_columns.get("from_storey", 9999)
        ):
            positions.extend(extra_upper_columns.get("positions", []))

        for c_idx, (cx, cy) in enumerate(positions):
            column = ifcopenshell.api.run(
                "root.create_entity", model, ifc_class="IfcColumn",
            )
            column.Name = f"COL-{s_idx}-{c_idx}"

            # Profile
            profile = model.create_entity(
                "IfcRectangleProfileDef",
                ProfileType="AREA",
                XDim=float(column_dim_mm),
                YDim=float(column_dim_mm),
            )

            # Swept solid
            origin = model.create_entity(
                "IfcCartesianPoint", Coordinates=[0.0, 0.0, 0.0],
            )
            position = model.create_entity(
                "IfcAxis2Placement3D", Location=origin,
            )
            solid = model.create_entity(
                "IfcExtrudedAreaSolid",
                SweptArea=profile,
                Position=position,
                ExtrudedDirection=extrude_dir,
                Depth=float(storey_height_mm),
            )

            # Representation chain
            shape_rep = model.create_entity(
                "IfcShapeRepresentation",
                ContextOfItems=body_ctx,
                RepresentationIdentifier="Body",
                RepresentationType="SweptSolid",
                Items=[solid],
            )
            prod_shape = model.create_entity(
                "IfcProductDefinitionShape",
                Representations=[shape_rep],
            )
            column.Representation = prod_shape

            # Placement (relative to storey)
            col_pt = model.create_entity(
                "IfcCartesianPoint",
                Coordinates=[float(cx), float(cy), 0.0],
            )
            col_ax = model.create_entity(
                "IfcAxis2Placement3D", Location=col_pt,
            )
            col_lp = model.create_entity(
                "IfcLocalPlacement",
                PlacementRelTo=storey.ObjectPlacement,
                RelativePlacement=col_ax,
            )
            column.ObjectPlacement = col_lp

            # Spatial containment
            ifcopenshell.api.run(
                "spatial.assign_container", model,
                relating_structure=storey, product=column,
            )

    # ── Stairs ───────────────────────────────────────────────────────
    for i in range(min(stairs_up_to_storey, num_storeys - 1)):
        stair = ifcopenshell.api.run(
            "root.create_entity", model, ifc_class="IfcStair",
        )
        stair.Name = f"STAIR-{i}-{i + 1}"
        ifcopenshell.api.run(
            "spatial.assign_container", model,
            relating_structure=storeys[i], product=stair,
        )

        flight = ifcopenshell.api.run(
            "root.create_entity", model, ifc_class="IfcStairFlight",
        )
        flight.Name = f"FLIGHT-{i}-{i + 1}"
        ifcopenshell.api.run(
            "spatial.assign_container", model,
            relating_structure=storeys[i], product=flight,
        )

    # ── Write ────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    model.write(output_path)
    return output_path


# ──────────────────────────────────────────────────────────────────────
# Public generators
# ──────────────────────────────────────────────────────────────────────

_GRID_POSITIONS = [
    (1000.0, 1000.0),
    (7000.0, 1000.0),
    (1000.0, 7000.0),
    (7000.0, 7000.0),
]


def generate_compliant_building(output_path: str) -> str:
    """
    4-storey building — fully compliant:
    • 300 × 300 mm columns (above 200 mm threshold)
    • Stairs on every inter-storey connection
    • All columns vertically aligned
    """
    return _create_building(
        output_path,
        project_name="Compliant Residential Tower",
        num_storeys=4,
        storey_height_mm=3000.0,
        column_dim_mm=300.0,
        column_positions=_GRID_POSITIONS,
        stairs_up_to_storey=3,   # 0→1, 1→2, 2→3
    )


def generate_violating_building(output_path: str) -> str:
    """
    8-storey building — designed to trip every rule:
    • 8 storeys (exceeds 5-storey zoning limit)
    • 150 mm columns (below 200 mm threshold)
    • Stairs only on levels 0-3 (upper levels missing egress)
    • Floating column at (4000, 4000) from storey 5 upwards
    """
    return _create_building(
        output_path,
        project_name="Violating Residential Tower",
        num_storeys=8,
        storey_height_mm=3000.0,
        column_dim_mm=150.0,
        column_positions=_GRID_POSITIONS,
        stairs_up_to_storey=4,   # only 0→1, 1→2, 2→3, 3→4
        extra_upper_columns={
            "from_storey": 5,
            "positions": [(4000.0, 4000.0)],
        },
    )


# ──────────────────────────────────────────────────────────────────────
# CLI entry-point
# ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    fixture_dir = os.path.join(os.path.dirname(__file__), "fixtures")
    os.makedirs(fixture_dir, exist_ok=True)

    p1 = generate_compliant_building(os.path.join(fixture_dir, "compliant_building.ifc"))
    print(f"✓ Generated {p1}")

    p2 = generate_violating_building(os.path.join(fixture_dir, "violating_building.ifc"))
    print(f"✓ Generated {p2}")
