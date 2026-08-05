"""Saved-search API (FR-019) — list, create, delete named filter combinations.

Applying a saved search is done client-side by feeding its stored values into
the same filter path used for live search, so there is no duplicate matching
logic here.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import select

from ..db import get_session
from ..models import SavedSearch

router = APIRouter(prefix="/api/saved-searches", tags=["saved-searches"])


class SavedSearchCreate(BaseModel):
    name: str
    keyword: str | None = None
    include_tags: list[str] = []
    exclude_tags: list[str] = []
    unread_only: bool = False


class SavedSearchOut(BaseModel):
    id: int
    name: str
    keyword: str | None
    include_tags: list[str]
    exclude_tags: list[str]
    unread_only: bool


def _split(value: str) -> list[str]:
    return [t for t in value.split(",") if t]


def _to_out(s: SavedSearch) -> SavedSearchOut:
    return SavedSearchOut(
        id=s.id,
        name=s.name,
        keyword=s.keyword,
        include_tags=_split(s.include_tags),
        exclude_tags=_split(s.exclude_tags),
        unread_only=s.unread_only,
    )


@router.get("", response_model=list[SavedSearchOut])
def list_saved_searches() -> list[SavedSearchOut]:
    with get_session() as session:
        rows = session.exec(select(SavedSearch).order_by(SavedSearch.name)).all()
        return [_to_out(s) for s in rows]


@router.post("", response_model=SavedSearchOut, status_code=201)
def create_saved_search(payload: SavedSearchCreate) -> SavedSearchOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="A name is required.")
    with get_session() as session:
        existing = session.exec(select(SavedSearch).where(SavedSearch.name == name)).first()
        if existing is not None:
            raise HTTPException(status_code=409, detail="A saved search with that name exists.")
        saved = SavedSearch(
            name=name,
            keyword=(payload.keyword or None),
            include_tags=",".join(t.strip().lower() for t in payload.include_tags if t.strip()),
            exclude_tags=",".join(t.strip().lower() for t in payload.exclude_tags if t.strip()),
            unread_only=payload.unread_only,
        )
        session.add(saved)
        session.commit()
        session.refresh(saved)
        return _to_out(saved)


@router.delete("/{search_id}", status_code=204)
def delete_saved_search(search_id: int) -> Response:
    with get_session() as session:
        saved = session.get(SavedSearch, search_id)
        if saved is None:
            raise HTTPException(status_code=404, detail="Saved search not found.")
        session.delete(saved)
        session.commit()
    return Response(status_code=204)
