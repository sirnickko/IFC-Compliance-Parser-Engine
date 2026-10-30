"""
Synthetic IFC Fixture Generator.

Creates two deterministic IFC4 building models for automated compliance testing:
1. `compliant_building.ifc`: 4-storey building, 300x300 mm columns, continuous stair egress.
2. `violating_building.ifc`: 8-storey building, 150x150 mm columns, unapproved top 4 floors,
   missing upper stairs, and floating discontinuous columns.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Tuple

import ifcopenshell
import ifcopenshell.api


def _create_synthetic_model(
    project_name: str,
    num_storeys: int,
    column_dim_mm: float,
    storey_height_mm: float = 3000.0,
    column_positions: Optional[List[Tuple[float, float]]] = None,
    stairs_up_to_storey: int = 4,
    floating_columns_from_storey: Optional[int] = None,
    floating_column_positions: Optional[List[Tuple[float, float]]] = None,
    output_path: str = "model.ifc",
) -> str:
    if column_positions is None:
        column_positions = [
            (1000.0, 1000.0),
            (7000.0, 1000.0),
            (1000.0, 7000.0),
            (7000.0, 7000.0),
        ]

    # Initialize IFC4 file
    model = ifcopenshell.file(schema="IFC4")

    # Project context
    project = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcProject")
    project.Name = project_name

    # Units: millimeters and degrees
    ifcopenshell.api.run(
        "unit.assign_unit",
        model,
        length={"is_metric": True, "raw": "MILLIMETRE"},
    )

    # Modeling 3D Context
    ctx3d = ifcopenshell.api.run(
        "context.add_context",
        model,
        context_type="Model",
        context_identifier=None,
        target_view=None,
    )
    body_ctx = ifcopenshell.api.run(
        "context.add_context",
        model,
        context_type="Model",
        context_identifier="Body",
        target_view="MODEL_VIEW",
        parent=ctx3d,
    )

    # Spatial Hierarchy: Project -> Site -> Building
    site = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSite")
    site.Name = "Civic Municipal Parcel"

    building = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuilding")
    building.Name = "LindaSite Residential Tower"

    ifcopenshell.api.run(
        "aggregate.assign_object",
        model,
        products=[site],
        relating_object=project,
    )
    ifcopenshell.api.run(
        "aggregate.assign_object",
        model,
        products=[building],
        relating_object=site,
    )

    # Storeys
    storeys = []
    for i in range(num_storeys):
        elevation = i * storey_height_mm
        storey = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey")
        storey.Name = f"Level {i}"
        storey.Elevation = float(elevation)

        pt = model.create_entity("IfcCartesianPoint", Coordinates=[0.0, 0.0, float(elevation)])
        ax = model.create_entity("IfcAxis2Placement3D", Location=pt)
        lp = model.create_entity("IfcLocalPlacement", RelativePlacement=ax)
        storey.ObjectPlacement = lp

        ifcopenshell.api.run(
            "aggregate.assign_object",
            model,
            products=[storey],
            relating_object=building,
        )
        storeys.append(storey)

    # Columns
    extrude_dir = model.create_entity("IfcDirection", DirectionRatios=[0.0, 0.0, 1.0])

    for s_idx, storey in enumerate(storeys):
        pos_list = list(column_positions)
        if (
            floating_columns_from_storey is not None
            and s_idx >= floating_columns_from_storey
            and floating_column_positions
        ):
            pos_list.extend(floating_column_positions)

        for c_idx, (cx, cy) in enumerate(pos_list):
            column = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcColumn")
            column.Name = f"COL-{s_idx}-{c_idx}"

            profile = model.create_entity(
                "IfcRectangleProfileDef",
                ProfileType="AREA",
                XDim=float(column_dim_mm),
                YDim=float(column_dim_mm),
            )

            origin = model.create_entity("IfcCartesianPoint", Coordinates=[0.0, 0.0, 0.0])
            position = model.create_entity("IfcAxis2Placement3D", Location=origin)
            solid = model.create_entity(
                "IfcExtrudedAreaSolid",
                SweptArea=profile,
                Position=position,
                ExtrudedDirection=extrude_dir,
                Depth=float(storey_height_mm),
            )

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

            col_pt = model.create_entity("IfcCartesianPoint", Coordinates=[float(cx), float(cy), 0.0])
            col_ax = model.create_entity("IfcAxis2Placement3D", Location=col_pt)
            col_lp = model.create_entity(
                "IfcLocalPlacement",
                PlacementRelTo=storey.ObjectPlacement,
                RelativePlacement=col_ax,
            )
            column.ObjectPlacement = col_lp

            ifcopenshell.api.run(
                "spatial.assign_container",
                model,
                products=[column],
                relating_structure=storey,
            )

    # Stairs
    for i in range(min(stairs_up_to_storey, num_storeys - 1)):
        stair = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcStair")
        stair.Name = f"STAIR-{i}-{i+1}"
        ifcopenshell.api.run(
            "spatial.assign_container",
            model,
            products=[stair],
            relating_structure=storeys[i],
        )

        flight = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcStairFlight")
        flight.Name = f"FLIGHT-{i}-{i+1}"
        ifcopenshell.api.run(
            "spatial.assign_container",
            model,
            products=[flight],
            relating_structure=storeys[i],
        )

    # Ensure parent output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    model.write(output_path)
    return output_path


def generate_compliant_building(output_path: str) -> str:
    """
    Compliant 4-storey building:
    - 4 storeys (matches max_permitted_floors=4)
    - 300 mm square columns (>= 200 mm requirement)
    - Continuous vertical stair egress up to roof
    - Vertically continuous column load path
    """
    return _create_synthetic_model(
        project_name="Compliant Civic Residential Complex",
        num_storeys=4,
        column_dim_mm=300.0,
        storey_height_mm=3000.0,
        stairs_up_to_storey=4,
        floating_columns_from_storey=None,
        output_path=output_path,
    )


def generate_violating_building(output_path: str) -> str:
    """
    Violating 8-storey building:
    - 8 storeys (violates zoning limit of 4 floors)
    - 150 mm square columns (violates 200 mm min threshold)
    - Missing stair flights on levels 4-7 (violates continuous vertical egress)
    - Floating / discontinuous columns at (4000, 4000) on levels 5-7 (violates load path)
    """
    return _create_synthetic_model(
        project_name="Violating Residential Tower (Illegal Addition)",
        num_storeys=8,
        column_dim_mm=150.0,
        storey_height_mm=3000.0,
        stairs_up_to_storey=3,  # Missing stairs on levels 4..7
        floating_columns_from_storey=5,
        floating_column_positions=[(4000.0, 4000.0)],
        output_path=output_path,
    )


if __name__ == "__main__":
    fixtures_dir = Path(__file__).resolve().parent / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    comp_path = str(fixtures_dir / "compliant_building.ifc")
    viol_path = str(fixtures_dir / "violating_building.ifc")

    print(f"Generating compliant fixture: {comp_path}...")
    generate_compliant_building(comp_path)
    print("Compliant fixture generated successfully.")

    print(f"Generating violating fixture: {viol_path}...")
    generate_violating_building(viol_path)
    print("Violating fixture generated successfully.")
