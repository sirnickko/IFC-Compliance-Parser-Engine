from typing import List, Dict, Any, Optional, Tuple
import math
import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.placement

from ..models.schemas import Finding, Severity


class RulesEngine:
    """
    Deterministic IFC geometry checks with advisory results.
    
    Loads rule provenance metadata from `rules.yaml` at the project root.
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
        # Load rule metadata
        import yaml, pathlib
        rules_path = pathlib.Path(__file__).resolve().parents[3] / "rules.yaml"
        if rules_path.is_file():
            with open(rules_path, "r", encoding="utf-8") as f:
                raw = yaml.safe_load(f) or []
            # index by id for quick lookup
            self.rule_meta: dict = {entry.get("id"): entry for entry in raw}
            alignment_params = self.rule_meta.get(
                "ERR_DISCONTINUOUS_COLUMN_LOADPATH", {}
            ).get("parameters", {})
            self.alignment_tolerance_mm = alignment_params.get(
                "tolerance_mm", alignment_tolerance_mm
            )
        else:
            self.rule_meta = {}

    def _apply_rule_meta(self, finding: Finding, rule_id: str) -> Finding:
        """Populate provenance fields on a Finding from loaded metadata if available."""
        meta = self.rule_meta.get(rule_id)
        if meta:
            # Only set fields that exist on the model
            if "source_document" in meta:
                finding.source_document = meta.get("source_document")
            if "clause_reference" in meta:
                finding.clause_reference = meta.get("clause_reference")
            if "last_reviewed" in meta:
                finding.last_reviewed = meta.get("last_reviewed")
            if "status" in meta:
                finding.status = meta.get("status")
        return finding

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

        # Column dimensions remain an engineer-review flag: the placeholder thresholds
        # are not a verified pass/fail criterion.

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

        return self._apply_rule_meta(
            Finding(
                id="ERR_STOREY_EXCEEDED",
                severity=Severity.CRITICAL,
                title="Mock parcel permitted storey count exceeded",
                element_guids=excess_guids,
                storey_names=excess_names,
                details=(
                    f"Model contains {total_storeys} storeys, exceeding the County municipal zoning limit "
                    f"of {self.max_permitted_floors} storeys by {diff} unapproved level(s)."
                ),
                structural_risk="Additional storeys increase cumulative gravity loads. This geometry check does not determine structural adequacy.",
                recommendation=(
                    "Confirm the applicable permit record with the county and request review by a registered engineer. "
                    "This advisory geometry check does not determine legal compliance or structural adequacy."
                ),
                standard_ref="Mock parcel record; planning source requires verification",
                statutory_action="Advisory only: refer permit questions to the relevant county authority.",
            ),
            "ERR_STOREY_EXCEEDED",
        )

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
            return self._apply_rule_meta(
                Finding(
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
                    structural_risk="The IFC geometry check detects stair element presence only; it does not assess egress adequacy.",
                    recommendation=(
                        "Extend a minimum 1000 mm wide reinforced concrete egress stair core continuously through all occupied storeys "
                        "directly down to an unobstructed ground-level exterior discharge exit."
                    ),
                    standard_ref="Kenya National Building Code 2024 / Occupational Safety and Health Act (OSHA 2007)",
                    statutory_action="Non-Compliant Fire Life-Safety Certificate: Development Approval Withheld",
                ),
                "ERR_MISSING_VERTICAL_EGRESS",
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

        return self._apply_rule_meta(
            Finding(
                id="ERR_DISCONTINUOUS_COLUMN_LOADPATH",
                severity=Severity.CRITICAL,
                title="Discontinuous Column Load Path / Floating Columns (NCA Collapse Risk #1)",
                element_guids=floating_guids,
                storey_names=floating_storeys,
                details=(
                    f"Detected {len(floating_cols)} column(s) on upper storeys with no direct vertical column "
                    f"support below (centroid offset > {self.alignment_tolerance_mm:.0f} mm)."
                ),
                structural_risk="Column alignment is a geometry proxy and does not establish a continuous structural load path.",
                recommendation=(
                    "Realign upper-storey columns vertically with the foundation column grid, or introduce a certified, "
                    "deep reinforced concrete transfer girder engineered and signed by an EBK-registered consulting engineer."
                ),
                standard_ref="NCA Collapse Investigation Directive #2024 / BS 8110-1:1997 Sec 3.4",
                statutory_action="Advisory only: request assessment by a registered structural engineer.",
            ),
            "ERR_DISCONTINUOUS_COLUMN_LOADPATH",
        )
