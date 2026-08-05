"""Bookmark create/list/get/update/delete + search services (User Stories 1, 2, 3, 4)."""

import re
from datetime import datetime, timezone
from html import escape

from sqlalchemy import func, text
from sqlmodel import Session, select

from ..db import fts
from ..models.bookmark import Bookmark
from ..models.tag import BookmarkTag, Tag
from . import tags as tag_service
from .metadata import fetch_metadata
from .sanitize import extract_text, sanitize_note_html
from .url_utils import is_valid_http_url, normalize_url


class InvalidURLError(ValueError):
    """Raised when a supplied address is not a well-formed http/https URL (FR-003)."""


class DuplicateURLError(ValueError):
    """Raised when an edit would collide with another bookmark's address (FR-004)."""


def create_bookmark(session: Session, url: str) -> tuple[Bookmark, bool]:
    """Create a bookmark from a URL.

    Returns ``(bookmark, is_duplicate)``. When the normalized URL already exists, the
    existing bookmark is returned with ``is_duplicate=True`` so the caller can open it for
    editing instead of creating a duplicate (FR-004).
    """
    url = url.strip()
    if not is_valid_http_url(url):
        raise InvalidURLError(url)

    normalized = normalize_url(url)
    existing = session.exec(
        select(Bookmark).where(Bookmark.url_normalized == normalized)
    ).first()
    if existing is not None:
        return existing, True

    meta = fetch_metadata(url)
    title = meta.title or url

    # The captured description seeds the (editable) note, per FR-002b / FR-015.
    note_html = None
    note_text = None
    if meta.description:
        note_html = sanitize_note_html(f"<p>{escape(meta.description)}</p>")
        note_text = extract_text(note_html)

    now = datetime.now(timezone.utc)
    bookmark = Bookmark(
        url=url,
        url_normalized=normalized,
        title=title,
        favicon=meta.favicon,
        favicon_mime=meta.favicon_mime,
        note_html=note_html,
        note_text=note_text,
        date_saved=now,
        date_modified=now,
    )
    session.add(bookmark)
    session.commit()
    session.refresh(bookmark)

    fts.sync_bookmark(
        session,
        bookmark.id,
        bookmark.title,
        bookmark.url,
        bookmark.note_text,
        tags="",
    )
    return bookmark, False


def _sync_fts(session: Session, bookmark: Bookmark) -> None:
    fts.sync_bookmark(
        session,
        bookmark.id,
        bookmark.title,
        bookmark.url,
        bookmark.note_text,
        tag_service.tags_as_document(bookmark),
    )


def _fts_match_expression(query: str) -> str | None:
    """Build a safe FTS5 match expression from a free-text query.

    - Double-quoted text becomes an exact adjacency phrase, e.g. `"chicken soup"` matches
      only where those words appear together in order (FR-012c).
    - Unquoted words each become a prefix term; all terms must match (AND) (FR-012a).

    Returns None when there is nothing to match.
    """
    parts: list[str] = []

    # Quoted phrases first: match adjacent words in order.
    for phrase in re.findall(r'"([^"]+)"', query):
        words = phrase.split()
        if words:
            parts.append('"' + " ".join(words) + '"')

    # Remaining unquoted words: prefix terms, AND-ed. Stray quotes are dropped.
    remainder = re.sub(r'"[^"]*"', " ", query)
    for token in remainder.replace('"', " ").split():
        parts.append(f'"{token}"*')

    if not parts:
        return None
    return " ".join(parts)


def list_bookmarks(
    session: Session,
    q: str | None = None,
    tag: str | None = None,
    sort: str = "recent",
) -> list[Bookmark]:
    """List bookmarks, optionally full-text searched (``q``) and/or tag-filtered.

    Search is case-insensitive across title/url/note/tags via the FTS index (FR-012);
    ``sort`` is ``recent`` (default) or ``title`` (FR-014).
    """
    statement = select(Bookmark)

    if q and q.strip():
        expr = _fts_match_expression(q)
        if expr is None:
            return []
        matched_ids = session.exec(
            text("SELECT bookmark_id FROM bookmarks_fts WHERE bookmarks_fts MATCH :expr"),
            params={"expr": expr},
        ).all()
        ids = [row[0] for row in matched_ids]
        if not ids:
            return []
        statement = statement.where(Bookmark.id.in_(ids))

    if tag and tag.strip():
        statement = (
            statement.join(BookmarkTag, BookmarkTag.bookmark_id == Bookmark.id)
            .join(Tag, Tag.id == BookmarkTag.tag_id)
            .where(func.lower(Tag.name) == tag.strip().lower())
        )

    if sort == "title":
        statement = statement.order_by(func.lower(Bookmark.title))
    else:
        statement = statement.order_by(Bookmark.date_saved.desc(), Bookmark.id.desc())

    return list(session.exec(statement).all())


def get_bookmark(session: Session, bookmark_id: int) -> Bookmark | None:
    return session.get(Bookmark, bookmark_id)


def update_bookmark(
    session: Session,
    bookmark_id: int,
    *,
    url: str | None = None,
    title: str | None = None,
    note_html: str | None = None,
    tags: list[str] | None = None,
) -> Bookmark | None:
    """Apply a partial edit to a bookmark (FR-008, FR-010, FR-015).

    Only the provided fields change. Editing the URL re-validates it and re-checks
    uniqueness against other bookmarks. Returns None if the bookmark does not exist.
    """
    bookmark = session.get(Bookmark, bookmark_id)
    if bookmark is None:
        return None

    if url is not None:
        url = url.strip()
        if not is_valid_http_url(url):
            raise InvalidURLError(url)
        normalized = normalize_url(url)
        clash = session.exec(
            select(Bookmark).where(
                Bookmark.url_normalized == normalized, Bookmark.id != bookmark_id
            )
        ).first()
        if clash is not None:
            raise DuplicateURLError(url)
        bookmark.url = url
        bookmark.url_normalized = normalized

    if title is not None:
        cleaned = title.strip()
        bookmark.title = cleaned or bookmark.url

    if note_html is not None:
        sanitized = sanitize_note_html(note_html)
        bookmark.note_html = sanitized
        bookmark.note_text = extract_text(sanitized)

    if tags is not None:
        tag_service.set_bookmark_tags(session, bookmark, tags)

    bookmark.date_modified = datetime.now(timezone.utc)
    session.add(bookmark)
    session.commit()
    session.refresh(bookmark)

    _sync_fts(session, bookmark)
    if tags is not None:
        tag_service.cleanup_orphan_tags(session)
        session.commit()
    return bookmark


def delete_bookmark(session: Session, bookmark_id: int) -> bool:
    """Delete a bookmark and its search/tag links (FR-009). Returns False if absent."""
    bookmark = session.get(Bookmark, bookmark_id)
    if bookmark is None:
        return False
    fts.delete_bookmark(session, bookmark_id)
    session.delete(bookmark)
    session.commit()
    tag_service.cleanup_orphan_tags(session)
    session.commit()
    return True
