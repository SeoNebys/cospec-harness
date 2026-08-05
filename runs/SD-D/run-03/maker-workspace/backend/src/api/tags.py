"""Tag API — suggestions (autocomplete) and the in-use filter list (FR-004a, FR-010)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..db import get_session
from ..services.tags import list_tags

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
def get_tags(
    prefix: str | None = Query(default=None),
    in_use: bool = Query(default=False),
) -> list[str]:
    """Return existing tag names.

    - `prefix`: only tags starting with this (typed-so-far), for autocomplete.
    - `in_use`: only tags currently on at least one bookmark (filter list).
    """
    with get_session() as session:
        return list_tags(session, prefix, in_use)
