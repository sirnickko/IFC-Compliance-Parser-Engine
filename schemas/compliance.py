"""
Pydantic v2 response schemas for the CivicShield IFC Compliance Certificate.

Defines the complete data contract for audit results, rule breakdowns,
violation details, and the top-level compliance certificate envelope.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class OverallStatus(str, Enum):
    """Compliance verdict for the audited IFC plan."""
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FLAGGED_FOR_MANUAL_REVIEW = "FLAGGED_FOR_MANUAL_REVIEW"


class ViolationDetail(BaseModel):
    """A single violation tied to a specific IFC element."""
    element_guid: str = Field(..., description="IFC GlobalId of the violating element")
    element_type: str = Field(..., description="IFC entity type (e.g. IfcColumn)")
    description: str = Field(..., description="Human-readable violation narrative")
    detected_value: Optional[str | float] = Field(
        default=None,
        description="The measured / detected value that triggered the violation",
    )


class RuleResult(BaseModel):
    """Outcome of a single compliance rule evaluation."""
    rule_id: str = Field(..., description="Machine-readable rule identifier")
    rule_name: str = Field(..., description="Human-readable rule title")
    passed: bool = Field(..., description="True if the rule was satisfied")
    message: str = Field(..., description="Summary explanation of the result")
    detected_values: dict[str, Any] = Field(
        default_factory=dict,
        description="Key metrics detected during evaluation",
    )
    violations: list[ViolationDetail] = Field(
        default_factory=list,
        description="Individual element-level violations, if any",
    )


class AuditSummary(BaseModel):
    """Aggregate statistics for the full audit run."""
    total_elements_audited: int = Field(0, ge=0)
    total_rules_evaluated: int = Field(0, ge=0)
    failed_checks: int = Field(0, ge=0)
    passed_checks: int = Field(0, ge=0)


class StoreyInfo(BaseModel):
    """Extracted data for a single IfcBuildingStorey."""
    name: str
    global_id: str
    elevation_m: float = Field(..., description="Storey elevation in metres")


class BuildingMetadata(BaseModel):
    """Metadata extracted from the IFC project header and spatial hierarchy."""
    project_name: Optional[str] = None
    schema_version: Optional[str] = None
    creation_timestamp: Optional[str] = None
    authoring_application: Optional[str] = None
    total_storeys: int = 0
    storeys: list[StoreyInfo] = Field(default_factory=list)
    total_building_height_m: Optional[float] = None


class ComplianceCertificate(BaseModel):
    """
    Top-level auditable compliance certificate returned by the engine.

    This is the primary response model for ``POST /api/v1/ifc/audit``.
    """
    parcel_id: str
    file_sha256: str
    audit_timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    overall_status: OverallStatus
    building_metadata: BuildingMetadata
    summary: AuditSummary
    rules_breakdown: list[RuleResult] = Field(default_factory=list)
