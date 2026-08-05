"""Export to the standard Netscape bookmark file (portable into any browser).

Tags travel two ways for maximum portability: as folders (universal) and as a
TAGS="a,b" attribute (which this app and some browsers read back). Notes are
emitted as a plain-text <DD> description — rich formatting flattens, and
read/archived state is not represented. This is the *lossy* export; the JSON
backup is the lossless one (FR-015).
"""

from __future__ import annotations

from html import escape

from ..models import Bookmark


def _add_date_attr(bookmark: Bookmark) -> str:
    try:
        return f' ADD_DATE="{int(bookmark.date_added.timestamp())}"'
    except (OverflowError, OSError, ValueError):
        return ""


def export_html(bookmarks: list[Bookmark]) -> str:
    lines = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        "<TITLE>Bookmarks</TITLE>",
        "<H1>Bookmarks</H1>",
        "<DL><p>",
    ]
    # Group by first tag so tags surface as folders for browsers that ignore TAGS.
    for bookmark in bookmarks:
        tag_names = sorted(t.name for t in bookmark.tags)
        tags_attr = f' TAGS="{escape(",".join(tag_names), quote=True)}"' if tag_names else ""
        folder = tag_names[0] if tag_names else None
        indent = "    "
        if folder:
            lines.append(f"{indent}<DT><H3>{escape(folder)}</H3>")
            lines.append(f"{indent}<DL><p>")
            indent = "        "
        lines.append(
            f'{indent}<DT><A HREF="{escape(bookmark.url, quote=True)}"'
            f"{_add_date_attr(bookmark)}{tags_attr}>{escape(bookmark.title)}</A>"
        )
        if bookmark.notes:
            lines.append(f"{indent}<DD>{escape(bookmark.notes)}")
        if folder:
            lines.append("    </DL><p>")
    lines.append("</DL><p>")
    return "\n".join(lines) + "\n"
