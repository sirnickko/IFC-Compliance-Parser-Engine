import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FIXTURES_DIR = BASE_DIR / "tests" / "fixtures"

PROJECT_NAME = "LindaSite Kenya — BIM/IFC Municipal Code & Structural Safety Engine"
API_V1_STR = "/api/v1"

env_origins = os.getenv("CORS_ORIGINS")
if env_origins:
    CORS_ORIGINS = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
else:
    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

# Kenyan Regulatory Defaults
DEFAULT_MIN_COLUMN_DIM_MM = 200.0  # Kenya Standard KS 04-245 / BS 8110-1:1997
DEFAULT_MAX_PERMITTED_FLOORS = 4   # Nairobi Zone 14 typical residential baseline

KENYAN_COUNTIES = [
    "Nairobi City County",
    "Kiambu County",
    "Mombasa County",
    "Machakos County",
    "Nakuru County",
    "Kisumu County",
]

KENYAN_ZONE_PRESETS = {
    "nairobi_zone_14": {
        "label": "Nairobi Zone 14 (Kasarani / Roysambu / Embakasi / Pipeline)",
        "county": "Nairobi City County",
        "max_floors": 4,
        "default_min_column_mm": 200.0,
        "description": "High-density residential. Primary hotspot for unapproved illegal storeys.",
    },
    "nairobi_zone_5": {
        "label": "Nairobi Zone 5 (Kileleshwa / Kilimani Residential)",
        "county": "Nairobi City County",
        "max_floors": 8,
        "default_min_column_mm": 250.0,
        "description": "High-density residential apartments.",
    },
    "nairobi_zone_4": {
        "label": "Nairobi Zone 4 (Lavington / Spring Valley / Karen)",
        "county": "Nairobi City County",
        "max_floors": 3,
        "default_min_column_mm": 200.0,
        "description": "Low-density single-family dwellings and townhouses.",
    },
    "kiambu_ruiru": {
        "label": "Kiambu County (Ruiru / Juja / Thika Corridor)",
        "county": "Kiambu County",
        "max_floors": 4,
        "default_min_column_mm": 200.0,
        "description": "High-density commuter settlement with frequent unapproved floor additions.",
    },
    "kiambu_kinoo": {
        "label": "Kiambu County (Kinoo / Kikuyu Mixed)",
        "county": "Kiambu County",
        "max_floors": 5,
        "default_min_column_mm": 200.0,
        "description": "Medium-to-high density residential development.",
    },
    "mombasa_island": {
        "label": "Mombasa County (Island / Nyali High-Density)",
        "county": "Mombasa County",
        "max_floors": 6,
        "default_min_column_mm": 250.0,
        "description": "Coastal multi-storey residential and commercial.",
    },
}
