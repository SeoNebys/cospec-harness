"""FastAPI application: wiring, error shape, and static frontend serving."""

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from ..db.engine import init_db
from .bookmarks import router as bookmarks_router
from .import_export import router as import_export_router
from .tags import router as tags_router

app = FastAPI(title="Bookmark Manager", version="0.1.0")

# During development the frontend runs on a separate Vite port; in the packaged app it is
# served from the same origin (see static mount below), so CORS is a dev-only convenience.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bookmarks_router)
app.include_router(tags_router)
app.include_router(import_export_router)


@app.on_event("startup")
def _on_startup() -> None:
    init_db()


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "invalid_request", "message": "Invalid request."}},
    )


def _normalize_error_detail(detail) -> dict:
    if isinstance(detail, dict) and "code" in detail:
        return detail
    return {"code": "error", "message": str(detail)}


@app.exception_handler(StarletteHTTPException)
async def _http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": _normalize_error_detail(exc.detail)},
    )


_logger = logging.getLogger("bookmark_manager")


@app.exception_handler(Exception)
async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    _logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "Something went wrong."}},
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# Serve the built frontend (packaged app / production). Harmless when absent in dev.
# Under a PyInstaller bundle the assets live under the extraction dir (sys._MEIPASS).
import sys  # noqa: E402

if getattr(sys, "_MEIPASS", None):
    _static_dir = Path(sys._MEIPASS) / "src" / "static"
else:
    _static_dir = Path(__file__).resolve().parent.parent / "static"

if (_static_dir / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
