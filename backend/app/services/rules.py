from typing import List, Dict, Any, Optional, Tuple
import math
import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.placement

from ..models.schemas import Finding, Severity


class RulesEngine:
    """
    Deterministic Kenyan municipal code compliance rules engine for IFC models.
    Enforces requirements from:
      - Physical and Land Use Planning Act, 2019 (Act No. 13 of 2019)
      - Kenya Standard KS 04-245 / BS 8110-1:1997 (Structural Use of Concrete)
      - Kenya National Building Code 2024
      - National Construction Authority (NCA) Defect & Collapse Directives
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

        storey_finding = self.check_storey_limit(model, storeys)
        if storey_finding:
            findings.append(storey_finding)

        col_findings = self.check_column_dimensions(model, columns)
        findings.extend(col_findings)

        stair_finding = self.check_egress_stairs(model, storeys, stairs)
        if stair_finding:
            findings.append(stair_finding)

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

        sorted_storeys = sorted(storeys, key=lambda s: s.get("elevation_mm", 0.0))
        excess_storeys = sorted_storeys[self.max_permitted_floors:]

        excess_guids = [s["global_id"] for s in excess_storeys if "global_id" in s]
        excess_names = [s["name"] for s in excess_storeys if "name" in s]
        diff = total_storeys - self.max_permitted_floors

        return Finding(
            id="ERR_STOREY_EXCEEDED",
            severity=Severity.CRITICAL,
            title="Zoning Storey Limit Exceeded (Physical Planning Act & County By-Laws)",
            element_guids=excess_guids,
            storey_names=excess_names,
            details=(
                f"Model contains {total_storeys} storeys, exceeding the County municipal zoning limit "
                f"of {self.max_permitted_floors} storeys by {diff} unapproved level(s)."
            ),
            structural_risk=(
                "Unapproved additional storeys impose massive cumulative dead and live loads exceeding "
                "foundation soil bearing capacity and lower-floor column design limits. In Kenya, this "
                "illegal vertical extension is the #1 cause of catastrophic progressive pancake collapses "
                "(as documented by NCA in the Kasarani, Huruma, and Kinoo disasters)."
            ),
            recommendation=(
                f"Demolish / remove the {diff} unapproved upper storey(s) ({', '.join(excess_names)}) "
                "from architectural and structural BIM drawings or obtain an amended development permit "
                "from County Physical Planning supported by re-certified geotechnical and foundation calculations "
                "from a registered EBK consulting engineer."
            ),
            standard_ref="Physical and Land Use Planning Act 2019 / County Zoning By-Laws",
            statutory_action="Issue NCA Section 23 Immediate Stop Work Order & County Revocation of Permit",
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

        is_critical = worst_dim < (self.min_column_dim_mm * 0.9)
        severity = Severity.CRITICAL if is_critical else Severity.WARNING
        code = "ERR_UNDERSIZED_COLUMN" if is_critical else "WARN_UNDERSIZED_COLUMN"

        return [
            Finding(
                id=code,
                severity=severity,
                title="Undersized Structural Column Cross-Section (KS 04-245 / BS 8110)",
                element_guids=affected_guids,
                storey_names=affected_storeys,
                details=(
                    f"Found {len(undersized_cols)} column(s) with cross-sectional dimension as small as "
                    f"{worst_dim:.1f} mm, violating the required minimum of {self.min_column_dim_mm:.1f} mm."
                ),
                structural_risk=(
                    "Sub-standard slender columns (< 200 mm) exhibit elevated slenderness ratios prone to "
                    "premature Euler buckling and brittle shear crushing under normal axial dead loads. "
                    "NCA collapse forensic audits repeatedly link 150 mm columns to abrupt, non-ductile building collapses "
                    "with zero advance deflection warnings."
                ),
                recommendation=(
                    f"Upsize all flagged columns to at least {self.min_column_dim_mm:.0f} mm x "
                    f"{self.min_column_dim_mm:.0f} mm (minimum 250 mm x 250 mm recommended for multi-storey residential). "
                    "Re-verify longitudinal high-yield reinforcement bars (Grade 500) and link confinement spacing "
                    "under BS 8110-1:1997 Cl 3.12 or Eurocode 2 (Kenya National Annex)."
                ),
                standard_ref="Kenya Standard KS 04-245 / BS 8110-1:1997 Cl 3.12",
                statutory_action="Require EBK-Registered Structural Engineer Core Sample Verification & Redesign",
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

        storey_names = [s["name"] for s in storeys]
        stairs_by_storey: Dict[str, int] = {name: 0 for name in storey_names}

        for st in stairs:
            st_storey = st.get("storey_name")
            if st_storey in stairs_by_storey:
                stairs_by_storey[st_storey] += 1

        missing_storeys = [name for name, count in stairs_by_storey.items() if count == 0]
        required_flights = total_storeys - 1
        total_stairs = len(stairs)

        if total_stairs < required_flights or (missing_storeys and len(missing_storeys) > 1):
            return Finding(
                id="ERR_MISSING_VERTICAL_EGRESS",
                severity=Severity.CRITICAL,
                title="Inadequate or Discontinuous Vertical Stair Egress (Kenya Building Code)",
                element_guids=[st["global_id"] for st in stairs],
                storey_names=missing_storeys or storey_names[-1:],
                details=(
                    f"Building has {total_storeys} storeys requiring at least {required_flights} "
                    f"continuous stair flights, but only {total_stairs} stair element(s) were found. "
                    f"Storeys lacking direct egress connection: {', '.join(missing_storeys) if missing_storeys else 'Upper levels'}."
                ),
                structural_risk=(
                    "Absence of continuous, protected reinforced concrete stair cores violates the Kenya National Building Code "
                    "and OSHA 2007. Traps occupants on upper storeys during structural failure, fire, or seismic events."
                ),
                recommendation=(
                    "Extend a minimum 1000 mm wide reinforced concrete egress stair core continuously through all occupied storeys "
                    "directly down to an unobstructed ground-level exterior discharge exit."
                ),
                standard_ref="Kenya National Building Code 2024 / Occupational Safety and Health Act (OSHA 2007)",
                statutory_action="Non-Compliant Fire Life-Safety Certificate: Development Approval Withheld",
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

        sorted_storeys = sorted(storeys, key=lambda s: s.get("elevation_mm", 0.0))
        cols_by_storey: Dict[str, List[Dict[str, Any]]] = {
            s["name"]: [] for s in sorted_storeys
        }

        for col in columns:
            s_name = col.get("storey_name")
            if s_name in cols_by_storey:
                cols_by_storey[s_name].append(col)

        floating_cols: List[Dict[str, Any]] = []

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
            title="Discontinuous Column Load Path / Floating Columns (NCA Collapse Risk #1)",
            element_guids=floating_guids,
            storey_names=floating_storeys,
            details=(
                f"Detected {len(floating_cols)} column(s) on upper storeys with no direct vertical column "
                f"support below (centroid offset > {self.alignment_tolerance_mm:.0f} mm)."
            ),
            structural_risk=(
                "Discontinuous columns terminate mid-slab, transferring concentrated vertical loads "
                "into bending shear on non-transfer floor diaphragms. In Kenyan residential developments "
                "(e.g. Ruiru, Kinoo, Tassia collapses), omitting ground-floor columns for shops or parking "
                "without deep transfer girders is the leading trigger of punching shear failure and pancake collapse."
            ),
            recommendation=(
                "Realign upper-storey columns vertically with the foundation column grid, or introduce a certified, "
                "deep reinforced concrete transfer girder engineered and signed by an EBK-registered consulting engineer."
            ),
            standard_ref="NCA Collapse Investigation Directive #2024 / BS 8110-1:1997 Sec 3.4",
            statutory_action="Mandatory Structural Integrity Audit by National Building Inspectorate (NBI)",
        )
