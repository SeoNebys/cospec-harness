"""FastAPI application: JSON API under /api + serves the built frontend.

Single deployable, bound to localhost by the launch command. No auth — a single
local user (FR-012).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import bookmarks, porting, saved_searches, tags
from .db import init_db

# Location of the built frontend (frontend/dist), relative to repo root.
_FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Bookmark Manager", lifespan=lifespan)
app.include_router(bookmarks.router)
app.include_router(tags.router)
app.include_router(porting.router)
app.include_router(saved_searches.router)


@app.get("/api/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


def _mount_frontend() -> None:
    """Serve the built UI if present; otherwise show a helpful message at /."""
    if _FRONTEND_DIST.is_dir():
        app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
    else:

        @app.get("/", response_model=None)
        def frontend_missing() -> JSONResponse:
            return JSONResponse(
                {
                    "message": (
                        "Frontend not built yet. Run `npm install && npm run build` "
                        "in frontend/, then reload."
                    )
                },
                status_code=200,
            )


_mount_frontend()
