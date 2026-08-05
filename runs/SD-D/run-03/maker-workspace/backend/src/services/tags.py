"""Tag helpers: canonical get-or-create and suggestion/in-use listing (FR-004a).

Tags are canonicalized (trimmed + lowercased) so "recipe"/"Recipe"/" recipe "
resolve to one tag rather than drifting into duplicates.
"""

from __future__ import annotations

from sqlmodel import Session, select

from ..models import Bookmark, Tag


def get_or_create_tags(session: Session, names: list[str]) -> list[Tag]:
    """Resolve a list of raw tag names to Tag rows, creating missing ones.

    Duplicates within the input (after canonicalization) collapse to one.
    """
    resolved: dict[str, Tag] = {}
    for raw in names:
        canonical = Tag.canonical(raw)
        if not canonical or canonical in resolved:
            continue
        existing = session.exec(select(Tag).where(Tag.name == canonical)).first()
        if existing is None:
            existing = Tag(name=canonical)
            session.add(existing)
            session.flush()  # assign id
        resolved[canonical] = existing
    return list(resolved.values())


def list_tags(session: Session, prefix: str | None, in_use: bool) -> list[str]:
    """Return tag names, optionally filtered by prefix and/or in-use status."""
    tags = session.exec(select(Tag).order_by(Tag.name)).all()
    names: list[str] = []
    for tag in tags:
        if prefix and not tag.name.startswith(prefix.strip().lower()):
            continue
        if in_use and len(tag.bookmarks) == 0:
            continue
        names.append(tag.name)
    return names
