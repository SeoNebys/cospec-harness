"""SQLite FTS5 full-text index over bookmarks.

The index stores a synthesized document per bookmark (title + url + note text + tags) to
support case-insensitive keyword search (User Story 4). FTS5 tokenization is
case-insensitive by default. In the MVP the index is kept in sync on write; querying it
is wired up in the search story.
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlmodel import Session


def create_fts(engine: Engine) -> None:
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
                    bookmark_id UNINDEXED,
                    title,
                    url,
                    note_text,
                    tags
                )
                """
            )
        )
        conn.commit()


def sync_bookmark(
    session: Session,
    bookmark_id: int,
    title: str,
    url: str,
    note_text: str | None,
    tags: str | None,
) -> None:
    """Upsert a bookmark's searchable document. Call within an active session."""
    conn = session.connection()
    conn.execute(
        text("DELETE FROM bookmarks_fts WHERE bookmark_id = :id"),
        {"id": bookmark_id},
    )
    conn.execute(
        text(
            "INSERT INTO bookmarks_fts (bookmark_id, title, url, note_text, tags) "
            "VALUES (:id, :title, :url, :note, :tags)"
        ),
        {
            "id": bookmark_id,
            "title": title or "",
            "url": url or "",
            "note": note_text or "",
            "tags": tags or "",
        },
    )
    session.commit()


def delete_bookmark(session: Session, bookmark_id: int) -> None:
    conn = session.connection()
    conn.execute(
        text("DELETE FROM bookmarks_fts WHERE bookmark_id = :id"),
        {"id": bookmark_id},
    )
    session.commit()
