from typing import List, Dict, Any, Optional, Tuple
import math
import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.placement

from ..models.schemas import Finding, Severity


class RulesEngine:
    """
    Deterministic municipal code compliance rules engine for IFC models.
    """

    def __init__(
        self,
        max_permitted_floors: int = 4,
        min_column_dim_mm: float = 200.0,
        alignment_tolerance_mm: float = 500.0,
    ):
        self.max_permitted_floors = max_permitted_floors
        self.min_column_dim_mm = min_column_dim_mm
        self.alignment_tolerance_mm = alignment_tolerance_mm

    def evaluate_all(
        self,
        model: ifcopenshell.file,
        storeys: List[Dict[str, Any]],
        columns: List[Dict[str, Any]],
        stairs: List[Dict[str, Any]],
    ) -> List[Finding]:
        findings: List[Finding] = []

        # 1. Storey Limit Rule
        storey_finding = self.check_storey_limit(model, storeys)
        if storey_finding:
            findings.append(storey_finding)

        # 2. Column Cross-Section Rule
        col_findings = self.check_column_dimensions(model, columns)
        findings.extend(col_findings)

        # 3. Egress & Stairs Rule
        stair_finding = self.check_egress_stairs(model, storeys, stairs)
        if stair_finding:
            findings.append(stair_finding)

        # 4. Column Alignment Heuristic
        align_finding = self.check_column_continuity(model, storeys, columns)
        if align_finding:
            findings.append(align_finding)

        return findings

    def check_storey_limit(
        self, model: ifcopenshell.file, storeys: List[Dict[str, Any]]
    ) -> Optional[Finding]:
        total_storeys = len(storeys)
        if total_storeys <= self.max_permitted_floors:
            return None

        # Sorted by elevation ascending
        sorted_storeys = sorted(storeys, key=lambda s: s.get("elevation_mm", 0.0))
        excess_storeys = sorted_storeys[self.max_permitted_floors:]

        excess_guids = [s["global_id"] for s in excess_storeys if "global_id" in s]
        excess_names = [s["name"] for s in excess_storeys if "name" in s]
        diff = total_storeys - self.max_permitted_floors

        return Finding(
            id="ERR_STOREY_EXCEEDED",
            severity=Severity.CRITICAL,
            title="Zoning Storey Limit Exceeded",
            element_guids=excess_guids,
            storey_names=excess_names,
            details=(
                f"Model contains {total_storeys} storeys, exceeding the municipal zoning limit "
                f"of {self.max_permitted_floors} storeys by {diff} unapproved level(s)."
            ),
            structural_risk=(
                "Unapproved additional storeys impose massive cumulative gravity and seismic "
                "dead/live loads that exceed the foundation and lower-column design capacities, "
                "creating extreme vulnerability to progressive pancake collapse."
            ),
            recommendation=(
                f"Remove the {diff} unapproved upper storey(s) ({', '.join(excess_names)}) "
                "from the architectural/structural BIM model or submit an amended zoning variance "
                "supported by certified foundation re-engineering recalculations."
            ),
        )

    def check_column_dimensions(
        self, model: ifcopenshell.file, columns: List[Dict[str, Any]]
    ) -> List[Finding]:
        undersized_cols: List[Dict[str, Any]] = []

        for col in columns:
            min_dim = col.get("min_dimension_mm")
            if min_dim is not None and min_dim < self.min_column_dim_mm:
                undersized_cols.append(col)

        if not undersized_cols:
            return []

        affected_guids = [c["global_id"] for c in undersized_cols]
        affected_storeys = sorted(list({c.get("storey_name", "Unknown") for c in undersized_cols}))
        worst_dim = min((c.get("min_dimension_mm", 0.0) for c in undersized_cols), default=0.0)

        # Distinguish CRITICAL (< 180mm or < threshold by > 20%) vs WARNING
        is_critical = worst_dim < (self.min_column_dim_mm * 0.9)
        severity = Severity.CRITICAL if is_critical else Severity.WARNING
        code = "ERR_UNDERSIZED_COLUMN" if is_critical else "WARN_UNDERSIZED_COLUMN"

        return [
            Finding(
                id=code,
                severity=severity,
                title="Undersized Structural Column Cross-Section",
                element_guids=affected_guids,
                storey_names=affected_storeys,
                details=(
                    f"Found {len(undersized_cols)} column(s) with cross-sectional dimension as small as "
                    f"{worst_dim:.1f} mm, violating the required minimum of {self.min_column_dim_mm:.1f} mm."
                ),
                structural_risk=(
                    "Slender, undersized columns suffer from elevated slenderness ratios, making them prone "
                    "to premature lateral-torsional or Euler buckling under axial service loads, leading "
                    "to sudden explosive brittle shear failure and punching shear through floor slabs."
                ),
                recommendation=(
                    f"Upsize all flagged columns to at least {self.min_column_dim_mm:.0f} mm x "
                    f"{self.min_column_dim_mm:.0f} mm (or equivalent circular diameter) and re-verify "
                    "longitudinal rebar and transverse stirrup confinement spacing."
                ),
            )
        ]

    def check_egress_stairs(
        self,
        model: ifcopenshell.file,
        storeys: List[Dict[str, Any]],
        stairs: List[Dict[str, Any]],
    ) -> Optional[Finding]:
        total_storeys = len(storeys)
        if total_storeys <= 1:
            return None

        # Count stairs per storey level
        storey_names = [s["name"] for s in storeys]
        stairs_by_storey: Dict[str, int] = {name: 0 for name in storey_names}

        for st in stairs:
            st_storey = st.get("storey_name")
            if st_storey in stairs_by_storey:
                stairs_by_storey[st_storey] += 1

        # Check if upper occupied storeys have stairs
        missing_storeys = [name for name, count in stairs_by_storey.items() if count == 0]

        # Multi-storey buildings must have stairs connecting all levels up to top
        # At minimum, total stairs should be at least (total_storeys - 1)
        required_flights = total_storeys - 1
        total_stairs = len(stairs)

        if total_stairs < required_flights or (missing_storeys and len(missing_storeys) > 1):
            return Finding(
                id="ERR_MISSING_VERTICAL_EGRESS",
                severity=Severity.CRITICAL,
                title="Inadequate or Discontinuous Vertical Stair Egress",
                element_guids=[st["global_id"] for st in stairs],
                storey_names=missing_storeys or storey_names[-1:],
                details=(
                    f"Building has {total_storeys} storeys requiring at least {required_flights} "
                    f"continuous stair flights, but only {total_stairs} stair element(s) were found. "
                    f"Storeys lacking direct egress connection: {', '.join(missing_storeys) if missing_storeys else 'Upper levels'}."
                ),
                structural_risk=(
                    "Absence of continuous, protected vertical stair egress violates core municipal life-safety "
                    "codes, creating severe entrapment hazards during seismic, fire, or structural evacuation events."
                ),
                recommendation=(
                    "Extend the reinforced concrete egress stair core continuously through all occupied storeys "
                    "directly down to the ground-level exterior discharge exit."
                ),
            )

        return None

    def check_column_continuity(
        self,
        model: ifcopenshell.file,
        storeys: List[Dict[str, Any]],
        columns: List[Dict[str, Any]],
    ) -> Optional[Finding]:
        if len(storeys) < 2:
            return None

        # Group columns by storey
        sorted_storeys = sorted(storeys, key=lambda s: s.get("elevation_mm", 0.0))
        cols_by_storey: Dict[str, List[Dict[str, Any]]] = {
            s["name"]: [] for s in sorted_storeys
        }

        for col in columns:
            s_name = col.get("storey_name")
            if s_name in cols_by_storey:
                cols_by_storey[s_name].append(col)

        floating_cols: List[Dict[str, Any]] = []

        # Check each upper storey against the storey directly below it
        for i in range(1, len(sorted_storeys)):
            upper_storey = sorted_storeys[i]["name"]
            lower_storey = sorted_storeys[i - 1]["name"]

            upper_cols = cols_by_storey.get(upper_storey, [])
            lower_cols = cols_by_storey.get(lower_storey, [])

            if not upper_cols or not lower_cols:
                continue

            for u_col in upper_cols:
                u_x = u_col.get("x_mm")
                u_y = u_col.get("y_mm")
                if u_x is None or u_y is None:
                    continue

                # Find closest lower column
                has_bearing = False
                for l_col in lower_cols:
                    l_x = l_col.get("x_mm")
                    l_y = l_col.get("y_mm")
                    if l_x is None or l_y is None:
                        continue
                    dist = math.hypot(u_x - l_x, u_y - l_y)
                    if dist <= self.alignment_tolerance_mm:
                        has_bearing = True
                        break

                if not has_bearing:
                    floating_cols.append(u_col)

        if not floating_cols:
            return None

        floating_guids = [c["global_id"] for c in floating_cols]
        floating_storeys = sorted(list({c.get("storey_name", "Unknown") for c in floating_cols}))

        return Finding(
            id="ERR_DISCONTINUOUS_COLUMN_LOADPATH",
            severity=Severity.CRITICAL,
            title="Discontinuous Column Load Path (Floating Columns)",
            element_guids=floating_guids,
            storey_names=floating_storeys,
            details=(
                f"Detected {len(floating_cols)} column(s) on upper storeys with no direct vertical column "
                f"support below (centroid offset > {self.alignment_tolerance_mm:.0f} mm)."
            ),
            structural_risk=(
                "Discontinuous columns terminate mid-slab, transferring concentrated axial gravity loads "
                "into bending shear on floor diaphragms not engineered as transfer structures, risking sudden "
                "punching shear failure and multi-storey collapse."
            ),
            recommendation=(
                "Realign upper columns vertically with the lower structural grid, or introduce a certified, "
                "deep reinforced transfer girder/beam system to safely redirect vertical loads."
            ),
        )
