# CivicShield IFC Compliance Parser Engine

> **Automated BIM / IFC building-code compliance auditor** — ingests `.ifc` files, computes immutable cryptographic fingerprints, executes deterministic municipal compliance rules, and produces auditable JSON compliance certificates.

## Quick Start

```bash
# 1. Create & activate a virtual environment
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Generate synthetic test fixtures
python -m tests.synthetic_ifc_generator

# 4. Run the test suite
pytest -v

# 5. Start the API server
uvicorn main:app --reload --port 8000
```

## API Endpoints

### `POST /api/v1/ifc/audit`

Upload an `.ifc` file for compliance checking.

| Field | Type | Description |
|-------|------|-------------|
| `file` | `UploadFile` | IFC building model (`.ifc`) |
| `parcel_id` | `str` | Plot / parcel identification |
| `max_permitted_floors` | `int` | Municipal zoning floor limit |
| `min_column_dim_mm` | `float` | Min column cross-section (default: 200 mm) |

**Response:** `ComplianceCertificate` JSON with overall status (`APPROVED` / `REJECTED`), building metadata, audit summary, and per-rule breakdowns with element GUIDs.

### `GET /health`

Runtime health check verifying `ifcopenshell` is available.

## Compliance Rules

| Rule | ID | Description |
|------|----|-------------|
| A | `RULE_A_STOREY_LIMIT` | Max storey / height audit |
| B | `RULE_B_COLUMN_DIMENSION` | Column cross-section check |
| C | `RULE_C_EGRESS_SAFETY` | Vertical egress stair audit |
| D | `RULE_D_COLUMN_CONTINUITY` | Column vertical continuity |

## Architecture

```
main.py                     ← FastAPI endpoints
schemas/compliance.py       ← Pydantic v2 response models
services/ifc_parser.py      ← IFCAuditor (hash, metadata, storeys)
services/rules/base.py      ← Abstract BaseRule (Strategy Pattern)
services/rules/*.py          ← Concrete rule implementations
tests/synthetic_ifc_generator.py ← Programmatic IFC fixture factory
tests/test_*.py              ← Unit + integration test suite
```

## License

Internal use — CivicShield Engineering Division.
