from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class OverallStatus(str, Enum):
    APPROVED = "APPROVED"
    FLAGGED_FOR_REVIEW = "FLAGGED_FOR_REVIEW"
    REJECTED = "REJECTED"


class Finding(BaseModel):
    id: str = Field(..., description="Unique string violation code e.g. ERR_STOREY_EXCEEDED")
    severity: Severity = Field(..., description="Severity level: CRITICAL, WARNING, or INFO")
    title: str = Field(..., description="Short descriptive title of the violation")
    element_guids: List[str] = Field(default_factory=list, description="IFC GlobalIds associated with this violation")
    storey_names: Optional[List[str]] = Field(default=None, description="Names of building storeys affected")
    details: str = Field(..., description="Exact metrics detected vs allowed threshold")
    structural_risk: str = Field(..., description="Plain-English explanation of structural collapse hazard")
    recommendation: str = Field(..., description="Concrete actionable remediation required for compliance")
    standard_ref: Optional[str] = Field(default=None, description="Kenyan standard or statute reference (e.g. KS 04-245 / BS 8110)")
    statutory_action: Optional[str] = Field(default=None, description="Recommended county planning / NCA enforcement action")
    # New provenance fields
    source_document: Optional[str] = Field(default=None, description="Document where the rule originates")
    clause_reference: Optional[str] = Field(default=None, description="Clause or section reference within the source document")
    last_reviewed: Optional[str] = Field(default=None, description="Date the rule was last reviewed (ISO 8601)")
    status: Optional[str] = Field(default=None, description="Verification status: verified | needs_review")


class StoreyInfo(BaseModel):
    name: str
    global_id: str
    elevation_m: float
    height_m: Optional[float] = None


class BuildingMetadata(BaseModel):
    project_name: Optional[str] = None
    schema_version: Optional[str] = None
    creation_timestamp: Optional[str] = None
    authoring_application: Optional[str] = None
    total_storeys: int
    storeys: List[StoreyInfo] = Field(default_factory=list)
    total_building_height_m: Optional[float] = None
    total_columns: int = 0
    total_stairs: int = 0


class AuditSummary(BaseModel):
    total_elements_audited: int
    total_findings: int
    critical_count: int
    warning_count: int
    passed_checks: int
    overall_status: OverallStatus


class CheckStatusValue(str, Enum):
    PASSED = "Passed"
    FAILED = "Failed"
    COULD_NOT_CHECK = "Could not check"


class CheckStatus(BaseModel):
    id: str
    name: str
    status: CheckStatusValue
    detail: str


class Element3DGeometry(BaseModel):
    guid: str
    name: str
    type: str  # "IfcColumn", "IfcBuildingStorey", "IfcSlab", "IfcStair", "IfcStairFlight"
    storey: Optional[str] = None
    position: List[float]  # [x, y, z] in meters
    dimensions: List[float]  # [dx, dy, dz] in meters
    color_hint: Optional[str] = None
    change_status: Optional[str] = None


class ColumnSectionChange(BaseModel):
    guid: str
    name: str
    approved_section_mm: Optional[List[float]] = None
    current_section_mm: Optional[List[float]] = None


class VersionDiff(BaseModel):
    storeys_added: List[str] = Field(default_factory=list)
    storeys_removed: List[str] = Field(default_factory=list)
    columns_added: List[Element3DGeometry] = Field(default_factory=list)
    columns_removed: List[Element3DGeometry] = Field(default_factory=list)
    added_elements: List[Element3DGeometry] = Field(default_factory=list)
    removed_elements: List[Element3DGeometry] = Field(default_factory=list)
    columns_changed: List[ColumnSectionChange] = Field(default_factory=list)
    approved_height_m: Optional[float] = None
    current_height_m: Optional[float] = None
    height_change_m: Optional[float] = None
    approved_footprint_area_m2: Optional[float] = None
    current_footprint_area_m2: Optional[float] = None
    footprint_change_m2: Optional[float] = None
    statuses: Dict[str, CheckStatusValue]


class AuditResponse(BaseModel):
    file_sha256: str
    parcel_id: str
    county: Optional[str] = "Nairobi City County"
    zoning_zone: Optional[str] = "Nairobi Zone 14 (High-Density Residential)"
    audit_timestamp: str
    overall_status: OverallStatus
    metadata: BuildingMetadata
    summary: AuditSummary
    findings: List[Finding]
    elements_3d: List[Element3DGeometry] = Field(default_factory=list)
    checks: List[CheckStatus] = Field(default_factory=list)
