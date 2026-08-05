"""Import/export endpoints (User Stories 5 & 6). See contracts/api.md."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session

from ..db.engine import get_session
from ..services import bookmarks as bookmarks_service
from ..services import import_service
from ..services.netscape import MalformedImportError, write_netscape_bookmarks

router = APIRouter(prefix="/api", tags=["import-export"])


@router.post("/import")
async def import_bookmarks(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> dict:
    raw = await file.read()
    try:
        content = raw.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_file", "message": "Could not read that file."},
        )

    try:
        summary = import_service.import_bookmarks(session, content)
    except MalformedImportError:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_file",
                "message": "That doesn't look like a browser bookmarks file. Nothing was imported.",
            },
        )

    return {"added": summary.added, "skipped": summary.skipped}


@router.get("/export")
def export_bookmarks(session: Session = Depends(get_session)) -> Response:
    bookmarks = bookmarks_service.list_bookmarks(session, sort="recent")
    content = write_netscape_bookmarks(bookmarks)
    return Response(
        content=content,
        media_type="text/html",
        headers={"Content-Disposition": 'attachment; filename="bookmarks.html"'},
    )
