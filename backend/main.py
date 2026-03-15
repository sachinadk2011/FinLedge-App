import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.routes.bank import router as bank_router
from backend.routes.share import router as share_router
from backend.routes.summary import router as summary_router

app = FastAPI(title="Financial Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bank_router)
app.include_router(share_router)
app.include_router(summary_router)


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
