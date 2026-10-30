import sys
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.routes.bank import router as bank_router
from backend.routes.meta import router as meta_router
from backend.routes.personal_finance import router as personal_finance_router
from backend.routes.settings import router as settings_router
from backend.routes.share import router as share_router
from backend.routes.summary import router as summary_router
from backend.services.data_migration_service import run_pending_data_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Apply required schema migrations before serving, then backfill metadata quietly."""
    result = run_pending_data_migrations()
    print(f"[migration] {result.get('status', 'unknown')}: {result.get('source_file', '')}")
    if os.getenv("FINLEDGE_SHARED_SYNC_DIR"):
        from backend.services.metadata_backfill_service import start_metadata_backfill_worker
        from backend.services.shared_sync_service import start_shared_sync_worker
        start_metadata_backfill_worker()
        start_shared_sync_worker()
    yield


app = FastAPI(title="Financial Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bank_router)
app.include_router(meta_router)
app.include_router(personal_finance_router)
app.include_router(share_router)
app.include_router(summary_router)
app.include_router(settings_router)


@app.get("/health", include_in_schema=False)
def health_check():
    return {
        "status": "ok",
        "pid": os.getpid(),
        "instance": os.getenv("FINLEDGE_BACKEND_INSTANCE_TOKEN", ""),
    }


def _get_frontend_dist() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(getattr(sys, "_MEIPASS")) / "frontend_dist"

    return Path(__file__).resolve().parent.parent / "frontendwebapp" / "dist"


frontend_dist = _get_frontend_dist()
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_frontend_index():
        return FileResponse(frontend_dist / "index.html")
