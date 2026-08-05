"""Parse the Netscape Bookmark File Format (the bookmarks.html every browser exports).

We extract, per bookmark: its address, title, original ADD_DATE, and the folder path that
contained it (each nesting level becomes a tag). See research §5.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from typing import Iterable, Protocol


class MalformedImportError(ValueError):
    """Raised when a file is not a recognizable bookmark export (FR-017)."""


@dataclass
class ImportedBookmark:
    url: str
    title: str
    add_date: datetime | None
    tags: list[str] = field(default_factory=list)


def _parse_add_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromtimestamp(int(raw), tz=timezone.utc)
    except (ValueError, OverflowError, OSError):
        return None


class _NetscapeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.bookmarks: list[ImportedBookmark] = []
        # Stack of folder names for the DL currently being parsed (None for the root DL).
        self._folder_stack: list[str | None] = []
        self._pending_folder: str | None = None

        self._in_h3 = False
        self._h3_text = ""

        self._in_a = False
        self._a_text = ""
        self._a_href: str | None = None
        self._a_add_date: str | None = None
        self._a_tags: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        d = {k.lower(): (v or "") for k, v in attrs}
        if tag == "dl":
            # Entering a folder's contents: the most recent <H3> names this folder.
            self._folder_stack.append(self._pending_folder)
            self._pending_folder = None
        elif tag == "h3":
            self._in_h3 = True
            self._h3_text = ""
        elif tag == "a":
            self._in_a = True
            self._a_text = ""
            self._a_href = d.get("href")
            self._a_add_date = d.get("add_date")
            self._a_tags = d.get("tags")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "dl":
            if self._folder_stack:
                self._folder_stack.pop()
        elif tag == "h3":
            self._in_h3 = False
            self._pending_folder = self._h3_text.strip() or None
        elif tag == "a":
            self._in_a = False
            if self._a_href:
                # Tags come from enclosing folders plus an optional TAGS attribute
                # (which our own export writes), de-duplicated case-insensitively.
                tags: list[str] = [f for f in self._folder_stack if f]
                if self._a_tags:
                    tags += [t.strip() for t in self._a_tags.split(",") if t.strip()]
                seen: set[str] = set()
                deduped = []
                for t in tags:
                    if t.lower() not in seen:
                        seen.add(t.lower())
                        deduped.append(t)
                self.bookmarks.append(
                    ImportedBookmark(
                        url=self._a_href.strip(),
                        title=self._a_text.strip() or self._a_href.strip(),
                        add_date=_parse_add_date(self._a_add_date),
                        tags=deduped,
                    )
                )
            self._a_href = None
            self._a_add_date = None
            self._a_tags = None

    def handle_data(self, data: str) -> None:
        if self._in_h3:
            self._h3_text += data
        elif self._in_a:
            self._a_text += data


def parse_netscape_bookmarks(content: str) -> list[ImportedBookmark]:
    """Parse bookmark export text. Raises MalformedImportError if unrecognizable."""
    lowered = content.lower()
    looks_like_export = "netscape-bookmark" in lowered or "<a " in lowered

    parser = _NetscapeParser()
    parser.feed(content)

    if not looks_like_export and not parser.bookmarks:
        raise MalformedImportError("Not a recognized bookmark export file.")
    return parser.bookmarks


class _ExportableBookmark(Protocol):
    url: str
    title: str
    date_saved: datetime

    @property
    def tags(self) -> list: ...


def write_netscape_bookmarks(bookmarks: Iterable[_ExportableBookmark]) -> str:
    """Serialize bookmarks to the Netscape format (FR-018).

    Flat list with ADD_DATE (so dates survive) and a TAGS attribute (so our own re-import
    restores tags). Re-openable in browsers, which ignore the TAGS attribute. An empty
    collection still yields a valid file.
    """
    lines = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        "<TITLE>Bookmarks</TITLE>",
        "<H1>Bookmarks</H1>",
        "<DL><p>",
    ]
    for b in bookmarks:
        add_date = int(b.date_saved.timestamp())
        attrs = f' ADD_DATE="{add_date}"'
        tag_names = ",".join(tag.name for tag in b.tags)
        if tag_names:
            attrs += f' TAGS="{escape(tag_names, quote=True)}"'
        href = escape(b.url, quote=True)
        title = escape(b.title)
        lines.append(f"    <DT><A HREF=\"{href}\"{attrs}>{title}</A>")
    lines.append("</DL><p>")
    return "\n".join(lines) + "\n"
