"""Full-fidelity JSON backup export (FR-015).

Loses nothing: tags, Markdown notes, read/unread, archived, and original dates.
Re-importable into this app with no loss (SC-008). This is the "your stuff is
never trapped" safety net.
"""

from __future__ import annotations

import json

from ..models import Bookmark

BACKUP_VERSION = 1


def export_json(bookmarks: list[Bookmark]) -> str:
    payload = {
        "version": BACKUP_VERSION,
        "bookmarks": [
            {
                "url": b.url,
                "title": b.title,
                "icon": b.icon,
                "description": b.description,
                "notes": b.notes,
                "date_added": b.date_added.isoformat(),
                "is_read": b.is_read,
                "is_archived": b.is_archived,
                "tags": sorted(t.name for t in b.tags),
            }
            for b in bookmarks
        ],
    }
    return json.dumps(payload, indent=2)
