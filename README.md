# CivicShield — Full-Stack BIM/IFC Plan Audit, 3D Weakness Spotter & Remediation Console

<p align="center">
  <img src="https://img.shields.io/badge/BIM%2FIFC-4.0%20%7C%202X3-blue?style=for-the-badge" alt="IFC Standard" />
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React%2018-TypeScript-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=threedotjs" alt="Three.js" />
  <img src="https://img.shields.io/badge/Status-Municipal%20Ready-emerald?style=for-the-badge" alt="Production Ready" />
</p>

Following multiple catastrophic residential building collapses caused by unapproved extra floors, compromised load paths, and undersized structural members, **CivicShield** provides municipal building inspectors and structural engineers with an automated, local-first platform to:

1. **Ingest & Fingerprint**: Ingest Industry Foundation Classes (`.ifc`) models and compute an immutable SHA-256 plan fingerprint for tamper-proof provenance.
2. **Deterministic Compliance Rules**: Automatically evaluate storey limits against cadastral parcel zoning, column cross-sections against minimum safety thresholds, continuous vertical stair egress, and vertical column load-path continuity.
3. **Interactive 3D WebGL Spotter**: Render full structural geometry in Three.js with real-time color-coded highlight overlays (**Red = Critical**, **Amber = Warning**, **Neutral = Compliant**).
4. **Remediation Console**: Provide plain-English engineering hazard assessments and concrete remediation callouts with camera focus.

---

## Architecture Overview

```
IFC-Compliance-Parser-Engine/ (CivicShield Monorepo)
├── backend/                       # FastAPI Python Service
│   ├── app/
│   │   ├── api/routes.py          # /api/v1/plans/audit, /api/v1/plans/sample-audit/*, /health
│   │   ├── core/config.py         # Zoning defaults, CORS, paths
│   │   ├── models/schemas.py      # Pydantic v2 schemas: Finding, Element3DGeometry, AuditResponse
│   │   ├── services/
│   │   │   ├── ifc_auditor.py     # SHA-256 hash, metadata, 3D coordinates extraction
│   │   │   └── rules.py           # 4 Deterministic compliance checks
│   │   └── main.py                # FastAPI ASGI entrypoint
│   ├── tests/
│   │   ├── generate_synthetic_ifc.py # IFC4 synthetic fixture generator
│   │   ├── fixtures/              # compliant_building.ifc & violating_building.ifc
│   │   └── test_audit.py          # Full Pytest test suite
│   └── requirements.txt
├── frontend/                      # Vite + React (TypeScript) + Tailwind CSS + Three.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx         # Health status pill, demo model loader, certificate export
│   │   │   ├── PlanUploader.tsx   # Drag-and-drop .ifc, zoning inputs, SHA-256 receipt
│   │   │   ├── BIMViewer.tsx      # 3D Three.js WebGL viewer with camera focus
│   │   │   └── RemediationDrawer.tsx # Verdict banner, metrics, accordion remediation cards
│   │   ├── types/audit.ts         # TypeScript schema mirrors
│   │   ├── services/api.ts        # API client
│   │   ├── App.tsx                # 3-Panel responsive dashboard
│   │   └── main.tsx
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

---

## 4 Deterministic Compliance Rules

| Rule Code | Description | Default Threshold | Structural Risk |
|---|---|---|---|
| `ERR_STOREY_EXCEEDED` | Storey count vs. zoning limit | 4 Storeys | Unapproved extra floors impose massive cumulative gravity and seismic dead/live loads that exceed foundation design capacities, risking progressive pancake collapse. |
| `ERR_UNDERSIZED_COLUMN` | Structural column min width/diameter | 200 mm | Slender columns suffer from elevated slenderness ratios, causing sudden Euler buckling, brittle shear failure, and punching shear through floor slabs. |
| `ERR_MISSING_VERTICAL_EGRESS` | Continuous stair egress across storeys | All levels | Absence of continuous stair cores traps occupants during fire or seismic evacuation. |
| `ERR_DISCONTINUOUS_COLUMN_LOADPATH` | Vertical column centroid alignment | 500 mm tolerance | Floating columns terminated mid-slab transfer axial gravity into bending moments on non-transfer floor diaphragms, causing punching shear failure. |

---

## Getting Started

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** / **npm 9+**

### 2. Backend Setup
```bash
# Navigate to backend directory or project root
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
# or: source .venv/bin/activate # Linux/macOS

pip install -r requirements.txt

# Run automated tests
pytest tests/test_audit.py -v

# Start FastAPI backend server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
# In a separate terminal
cd frontend
npm install
npm run dev
```
CivicShield Web Console will be live at: `http://localhost:5173`

---

## Testing with Synthetic Fixtures

Synthetic models are generated programmatically using `ifcopenshell.api`:
- **`fixtures/compliant_building.ifc`**: 4-storey structure with 300x300 mm columns and functional continuous stairs. Returns `APPROVED`.
- **`fixtures/violating_building.ifc`**: 8-storey structure with 150 mm columns, missing upper stairs, and floating discontinuous columns. Returns `REJECTED`.

To generate or regenerate fixtures:
```bash
python backend/tests/generate_synthetic_ifc.py
```
You can also click **"Load Sample Demo Model"** in the web console's top navbar to test both models in 1 click!

---

## License
MIT Municipal Building Safety License.
