"""Tag endpoints (User Story 4). See contracts/api.md."""

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from ..db.engine import get_session
from ..services import tags as service

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
def list_tags(session: Session = Depends(get_session)) -> list[dict]:
    """All tags in use, each with a bookmark count (FR-011)."""
    return service.list_tags_with_counts(session)


@router.get("/suggest")
def suggest_tags(
    prefix: str = Query("", alias="prefix"),
    session: Session = Depends(get_session),
) -> list[str]:
    """Existing tag names matching a typed prefix, case-insensitive (FR-010a)."""
    return service.suggest_tags(session, prefix)
