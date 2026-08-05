"""Import bookmarks from a Netscape export (User Story 5).

Folders become tags (FR-016a), original ADD_DATE is preserved (FR-016b), and addresses
already saved are skipped (FR-016). Favicons/metadata are NOT fetched during import — that
would make a 500-bookmark import far too slow (SC-007); icons fill in if the user re-saves.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlmodel import Session, select

from ..db import fts
from ..models.bookmark import Bookmark
from . import tags as tag_service
from .netscape import parse_netscape_bookmarks
from .url_utils import is_valid_http_url, normalize_url


@dataclass
class ImportSummary:
    added: int
    skipped: int


def import_bookmarks(session: Session, content: str) -> ImportSummary:
    """Parse and import. Raises netscape.MalformedImportError on an unrecognized file."""
    records = parse_netscape_bookmarks(content)

    existing = set(session.exec(select(Bookmark.url_normalized)).all())
    added = 0
    skipped = 0
    created: list[Bookmark] = []

    for record in records:
        url = record.url.strip()
        if not is_valid_http_url(url):
            skipped += 1
            continue
        normalized = normalize_url(url)
        if normalized in existing:
            skipped += 1
            continue
        existing.add(normalized)

        when = record.add_date or datetime.now(timezone.utc)
        bookmark = Bookmark(
            url=url,
            url_normalized=normalized,
            title=record.title or url,
            date_saved=when,
            date_modified=when,
        )
        session.add(bookmark)
        session.flush()  # assign id
        if record.tags:
            tag_service.set_bookmark_tags(session, bookmark, record.tags)
        created.append(bookmark)
        added += 1

    session.commit()

    # Populate the search index for everything we added.
    for bookmark in created:
        fts.sync_bookmark(
            session,
            bookmark.id,
            bookmark.title,
            bookmark.url,
            bookmark.note_text,
            tag_service.tags_as_document(bookmark),
        )

    return ImportSummary(added=added, skipped=skipped)
