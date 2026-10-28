import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FIXTURES_DIR = BASE_DIR / "tests" / "fixtures"

PROJECT_NAME = "CivicShield BIM/IFC Compliance Engine"
API_V1_STR = "/api/v1"
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",
]

DEFAULT_MIN_COLUMN_DIM_MM = 200.0
DEFAULT_MAX_PERMITTED_FLOORS = 4
