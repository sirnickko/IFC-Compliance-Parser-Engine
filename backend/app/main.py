from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .core.config import CORS_ORIGINS, FIXTURES_DIR, PROJECT_NAME


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure fixtures exist for demo mode
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    compliant_path = FIXTURES_DIR / "compliant_building.ifc"
    violating_path = FIXTURES_DIR / "violating_building.ifc"

    try:
        from tests.generate_synthetic_ifc import (
            generate_compliant_building,
            generate_violating_building,
        )
        if not compliant_path.exists():
            generate_compliant_building(str(compliant_path))
        if not violating_path.exists():
            generate_violating_building(str(violating_path))
    except Exception as e:
        print(f"[CivicShield] Warning during pre-generating fixtures: {e}")

    yield


app = FastAPI(
    title=PROJECT_NAME,
    version="1.0.0",
    description="Municipal BIM/IFC Plan Audit, 3D Weakness Spotter & Structural Remediation Engine",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router under /api/v1 and top-level /health
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router)  # Also provides /health at root level


@app.get("/", tags=["System"])
def root():
    return {
        "service": PROJECT_NAME,
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health",
        "audit_endpoint": "/api/v1/plans/audit",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
