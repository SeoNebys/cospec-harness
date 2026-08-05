"""Tag services: case-insensitive get-or-create, listing with counts, suggestions."""

from sqlalchemy import func
from sqlmodel import Session, select

from ..models.bookmark import Bookmark
from ..models.tag import BookmarkTag, Tag


def _normalize_name(name: str) -> str:
    return name.strip()


def get_or_create_tag(session: Session, name: str) -> Tag | None:
    """Return the tag matching ``name`` case-insensitively, creating it if absent.

    Returns ``None`` for blank input. The first-seen casing is preserved for display;
    later variants (e.g. "recipe" after "Recipe") map to the existing tag (FR-010a).
    """
    clean = _normalize_name(name)
    if not clean:
        return None
    existing = session.exec(
        select(Tag).where(func.lower(Tag.name) == clean.lower())
    ).first()
    if existing is not None:
        return existing
    tag = Tag(name=clean)
    session.add(tag)
    session.flush()  # assign id without ending the transaction
    return tag


def set_bookmark_tags(session: Session, bookmark: Bookmark, names: list[str]) -> None:
    """Replace a bookmark's tags with the given set, de-duplicated case-insensitively."""
    resolved: list[Tag] = []
    seen: set[str] = set()
    for name in names:
        clean = _normalize_name(name)
        key = clean.lower()
        if not clean or key in seen:
            continue
        seen.add(key)
        tag = get_or_create_tag(session, clean)
        if tag is not None:
            resolved.append(tag)
    bookmark.tags = resolved
    session.flush()


def cleanup_orphan_tags(session: Session) -> None:
    """Delete tags no longer attached to any bookmark (spec edge case)."""
    orphans = session.exec(
        select(Tag).where(
            ~select(BookmarkTag.tag_id)
            .where(BookmarkTag.tag_id == Tag.id)
            .exists()
        )
    ).all()
    for tag in orphans:
        session.delete(tag)
    if orphans:
        session.flush()


def list_tags_with_counts(session: Session) -> list[dict]:
    """All tags in use, with how many bookmarks carry each (FR-011 filter UI)."""
    rows = session.exec(
        select(Tag.name, func.count(BookmarkTag.bookmark_id))
        .join(BookmarkTag, BookmarkTag.tag_id == Tag.id)
        .group_by(Tag.id)
        .order_by(func.lower(Tag.name))
    ).all()
    return [{"name": name, "count": count} for name, count in rows]


def suggest_tags(session: Session, prefix: str, limit: int = 10) -> list[str]:
    """Existing tag names starting with ``prefix`` (case-insensitive) (FR-010a)."""
    clean = prefix.strip().lower()
    statement = select(Tag.name)
    if clean:
        statement = statement.where(func.lower(Tag.name).like(f"{clean}%"))
    statement = statement.order_by(func.lower(Tag.name)).limit(limit)
    return list(session.exec(statement).all())


def tags_as_document(bookmark: Bookmark) -> str:
    """Space-joined tag names for the FTS document."""
    return " ".join(tag.name for tag in bookmark.tags)
