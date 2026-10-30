# LindaSite Kenya — BIM/IFC Municipal Code & Structural Safety Engine

<p align="center">
  <img src="https://img.shields.io/badge/Jurisdiction-Republic%20of%20Kenya-red?style=for-the-badge" alt="Kenya" />
  <img src="https://img.shields.io/badge/Standard-NCA%20%7C%20KS%2004--245%20%7C%20BS%208110-blue?style=for-the-badge" alt="Standards" />
  <img src="https://img.shields.io/badge/BIM%2FIFC-ArchiCAD%20%7C%20Revit-green?style=for-the-badge" alt="BIM" />
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React%2018-TypeScript-61DAFB?style=for-the-badge&logo=react" alt="React" />
</p>

Following catastrophic residential building collapses across Kenya (**Kasarani**, **Huruma**, **Tassia**, **Kinoo**, and **Ruiru**) triggered by illegal extra floors, undersized slender columns, and unengineered load path alterations, **LindaSite Kenya** provides municipal county building inspectors, National Construction Authority (NCA) quality assurance teams, and consulting structural engineers with an automated, tamper-proof gatekeeper platform to:

1. **Ingest & Fingerprint**: Ingest Industry Foundation Classes (`.ifc`) models exported from **ArchiCAD** or **Revit** and compute an immutable SHA-256 plan fingerprint for tamper-proof provenance.
2. **Deterministic Kenyan Compliance Rules**:
   - **Storey Limits vs. County Permits**: *Physical and Land Use Planning Act, 2019* & County Zoning By-Laws (e.g. Nairobi Zone 14 vs Zone 5).
   - **Column Slenderness**: *Kenya Standard KS 04-245 & BS 8110-1:1997 Cl 3.12* (flags 150 mm rogue columns).
   - **Vertical Stair Fire Egress**: *Kenya National Building Code 2024* & *OSHA 2007*.
   - **Column Load-Path Continuity**: Detects floating columns terminated mid-slab without transfer girders (the primary trigger in the Kinoo and Ruiru collapses).
3. **Interactive 3D WebGL Spotter**: Renders complete structural geometry in Three.js with real-time color-coded highlight overlays (**Red = Critical**, **Amber = Warning**, **Neutral = Compliant**).
4. **Remediation & Enforcement Console**: Plain-English engineering risk assessment and actionable legal directives (e.g. *NCA Section 23 Stop Work Notice*).

---

## 4 Kenyan Deterministic Compliance Rules

| Rule Code | Kenyan Standard / Statute | Default Threshold | Collapse Hazard & Forensic Precedent |
|---|---|---|---|
| `ERR_STOREY_EXCEEDED` | *Physical and Land Use Planning Act 2019* / County Zoning By-Laws | Nairobi Zone 14: 4 Storeys | Unapproved extra floors impose massive cumulative dead/live loads that exceed foundation design capacities, risking progressive pancake collapse (Kasarani & Huruma collapses). |
| `ERR_UNDERSIZED_COLUMN` | *Kenya Standard KS 04-245 / BS 8110-1:1997 Cl 3.12* | 200 mm min section | Slender 150 mm columns suffer from elevated slenderness ratios, causing premature Euler buckling and explosive brittle shear failure under axial service loads. |
| `ERR_MISSING_VERTICAL_EGRESS` | *Kenya National Building Code 2024* / *OSHA 2007* | All occupied storeys | Absence of continuous reinforced concrete stair cores traps occupants during fire, seismic, or structural evacuation. |
| `ERR_DISCONTINUOUS_COLUMN_LOADPATH` | *NCA Collapse Directives* / *BS 8110 Sec 3.4* | 500 mm tolerance | Floating columns terminated mid-slab transfer axial gravity into bending moments on non-transfer floor diaphragms, causing punching shear failure (Kinoo & Ruiru collapses). |

---

## Getting Started

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** / **npm 9+**

### 2. Backend Setup
```bash
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
API Documentation is live at: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
LindaSite Kenya Console is live at: `http://localhost:5173`

---

## Exporting Drawings from ArchiCAD & Revit for Kenya

Kenyan architectural and structural drawings must be exported to IFC:
* **ArchiCAD** (Standard in Kenya): `File` → `Save As…` → Select format **`IFC 2x3`** or **`IFC 4`**
* **Autodesk Revit**: `File` → `Export` → **`IFC`**

---

## License
MIT Kenya Municipal Building Safety License.
