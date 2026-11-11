# SiteBeta Kenya

SiteBeta is a local, deterministic IFC geometry review tool. It is not connected to NCA or county systems, does not issue official approvals, and must not be used as a substitute for review by a registered engineer.

## What it checks

- IFC storey count against a selected **mock parcel record**.
- Presence of stair objects and column position alignment as limited geometry proxies.
- Extractable column section dimensions as an **engineer review flag only**; no minimum-size pass/fail decision is made.
- Optional comparison of approved and current IFC versions: storeys added/removed, columns added/removed/changed in section size, height changes, and footprint-area changes when geometry supports those calculations.

Every check reports **Passed**, **Failed**, or **Could not check**. A missing IFC property is not treated as a pass. Added elements appear green and removed elements appear red in the comparison viewer.

## Rule sources and verification status

Rule definitions and parameters are in [`rules.yaml`](rules.yaml). The active check identifiers are:

| Rule ID | Source document | Clause reference | Status |
|---|---|---|---|
| `ERR_STOREY_EXCEEDED` | County parcel permit record (mock) | TODO: verify applicable planning source | needs_review |
| `ENGINEER_REVIEW_COLUMN_SECTION` | TODO: document a source for the default and 150/300 mm fixtures | TODO | needs_review |
| `ERR_MISSING_VERTICAL_EGRESS` | Kenya National Building Code (source requires verification) | TODO | needs_review |
| `ERR_DISCONTINUOUS_COLUMN_LOADPATH` | TODO: verify source | TODO | needs_review |

No clause number is asserted because a verified clause was not supplied. The UI tags findings from these rules as **Unverified rule**. In particular, the 200 mm default and 150 mm / 300 mm example dimensions are placeholders, not approved structural criteria.

The correct statute name is **Physical and Land Use Planning Act, 2019**. A statute name alone does not establish that a specific geometry rule or threshold is legally required.

## Known limitations

- Advisory only. This is not an official approval; structural adequacy must be confirmed by a registered engineer.
- Geometry proxies do not check structural adequacy, material quality, reinforcement, foundation capacity, site conditions, or construction quality.
- IFC GlobalIds are used to match elements in a version comparison; exports that regenerate identifiers may appear as removed and added elements.
- Footprint area is a bounding-box approximation for available IFC slabs. Irregular/curved outlines and footprints split across multiple slabs may be over- or under-estimated; without usable slab geometry the result is **Could not check**.
- Mock parcel records in [`mock_parcels.json`](mock_parcels.json) are local sample data and are not county records.
- Uploads are limited to 50 MiB. Malformed files are rejected; incomplete models produce explicit check statuses where possible.
- The repository currently includes synthetic fixtures only. Three real/open-source IFC sample files could not be added in this environment because external downloads were unavailable; the synthetic fixtures are not represented as real projects.

## Parcel Map View

The Map View displays parcel polygons and linked audit results; it does not make compliance decisions. The included nine parcels are synthetic demo records around Kasarani, use `DEMO-LR-*` identifiers, contain no owner data, and every record is labeled `MOCK DEMO DATA`. Map styling is configurable with the frontend `VITE_MAP_STYLE_URL` environment variable. The development default is MapLibre's public demo style and has no paid key or service guarantee.

Parcel geometry is stored as WGS84 GeoJSON in SQLite (`SITEBETA_DB_PATH` can override the database path). Geometry is kept as GeoJSON rather than a SQLite-specific spatial format so the schema can migrate to PostGIS later. The API provides GeoJSON at `/api/parcels` (including optional `bbox=west,south,east,north` filtering), parcel details and audit history at `/api/parcels/{id}`, and audit linking at `/api/parcels/{id}/link-audit`; versioned equivalents remain under `/api/v1`.

The default demo map style is not production tile infrastructure. OpenStreetMap data is available under its own attribution and usage terms; do not hot-link the public `tile.openstreetmap.org` servers for a production application. Choose an appropriately licensed tile provider or host tiles yourself, and follow the selected provider's usage policy.

The typed map-layer registry reserves a disabled extension point for detected construction features. A future module could compare Sentinel imagery and open building-footprint datasets against parcel geometries, recording detection date, confidence, source-image date, and matched parcel. No satellite imagery, external detection API, or change detection is currently used.

## Run locally

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Tests

From the repository root, run `pytest backend/tests -q`. For the frontend production/type check and utility tests, run `cd frontend; npm run build; npm run test`.

The IFC checks run locally and do not call an external decision service. The frontend includes Vercel Analytics for page-view measurement; enable Web Analytics in the Vercel project's dashboard after deployment. Page-view analytics data is sent to Vercel. No paid service is required by this integration.
