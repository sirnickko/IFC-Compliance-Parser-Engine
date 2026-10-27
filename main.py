"""
CivicShield IFC Compliance Engine — FastAPI Application.

Exposes:
  POST /api/v1/ifc/audit   — upload an IFC file for compliance checking
  GET  /health              — runtime health / dependency check
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from schemas.compliance import (
    AuditSummary,
    BuildingMetadata,
    ComplianceCertificate,
    OverallStatus,
    RuleResult,
)
from services.ifc_parser import IFCAuditor
from services.rules import ALL_RULES

app = FastAPI(
    title="CivicShield IFC Compliance Engine",
    version="1.0.0",
    description=(
        "Automated BIM / IFC building-code compliance parser engine. "
        "Ingests IFC files, executes deterministic municipal compliance "
        "rules, and returns an auditable JSON compliance certificate."
    ),
)


# ──────────────────────────────────────────────────────────────────────
# Health endpoint
# ──────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    """Verify that critical runtime dependencies are importable."""
    try:
        import ifcopenshell  # noqa: F811
        ifc_version = getattr(ifcopenshell, "version", "unknown")
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"ifcopenshell runtime unavailable: {exc}",
        )
    return {
        "status": "healthy",
        "ifcopenshell_version": str(ifc_version),
        "engine": "civicshield-ifc-engine",
    }


# ──────────────────────────────────────────────────────────────────────
# Audit endpoint
# ──────────────────────────────────────────────────────────────────────

@app.post("/api/v1/ifc/audit", response_model=ComplianceCertificate)
async def audit_ifc(
    file: UploadFile = File(..., description="IFC building model file"),
    parcel_id: str = Form(..., description="Plot / parcel identification string"),
    max_permitted_floors: int = Form(..., description="Municipal zoning floor limit"),
    min_column_dim_mm: Optional[float] = Form(
        200.0,
        description="Minimum column cross-section dimension in mm (default 200)",
    ),
) -> ComplianceCertificate:
    """
    Ingest an ``.ifc`` file, run all compliance rules, and return
    a signed compliance certificate.
    """
    # ---- 1. Read & validate upload ----
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    # ---- 2. Parse IFC ----
    try:
        auditor = IFCAuditor(file_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse IFC file: {exc}",
        )

    # ---- 3. Extract metadata ----
    metadata: BuildingMetadata = auditor.get_metadata()

    # ---- 4. Build audit params ----
    params = {
        "max_permitted_floors": max_permitted_floors,
        "min_column_dim_mm": min_column_dim_mm or 200.0,
    }

    # ---- 5. Evaluate every rule ----
    results: list[RuleResult] = []
    for rule in ALL_RULES:
        try:
            result = rule.evaluate(auditor.model, auditor.unit_to_mm, params)
        except Exception as exc:
            result = RuleResult(
                rule_id=rule.rule_id,
                rule_name=rule.rule_name,
                passed=False,
                message=f"Rule evaluation error: {exc}",
                detected_values={"error": str(exc)},
            )
        results.append(result)

    # ---- 6. Compute aggregate status ----
    failed = sum(1 for r in results if not r.passed)
    passed = sum(1 for r in results if r.passed)
    total_elements = sum(
        r.detected_values.get("elements_checked", 0) for r in results
    )

    if failed > 0:
        overall = OverallStatus.REJECTED
    else:
        overall = OverallStatus.APPROVED

    # ---- 7. Assemble certificate ----
    certificate = ComplianceCertificate(
        parcel_id=parcel_id,
        file_sha256=auditor.file_hash,
        audit_timestamp=datetime.now(timezone.utc).isoformat(),
        overall_status=overall,
        building_metadata=metadata,
        summary=AuditSummary(
            total_elements_audited=total_elements,
            total_rules_evaluated=len(results),
            failed_checks=failed,
            passed_checks=passed,
        ),
        rules_breakdown=results,
    )

    return certificate
