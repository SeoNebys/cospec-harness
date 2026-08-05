"""Parse the Netscape bookmark file format (the HTML every browser exports).

We recover, per bookmark: url, title, original add-date, the folder path it sat
in (each level becomes a tag, FR-014), any TAGS="a,b" attribute, and the <DD>
description. Folder names and TAGS both feed the bookmark's tags.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from bs4 import BeautifulSoup

# Top-level browser container folders that hold everything and carry no
# organising meaning — skipped when turning folders into tags (FR-014).
WRAPPER_FOLDERS = {
    "bookmarks",
    "bookmarks bar",
    "bookmarks toolbar",
    "bookmarks menu",
    "favorites",
    "favourites",
    "favorites bar",
    "other bookmarks",
    "mobile bookmarks",
    "bookmarks toolbar folder",
}


@dataclass
class ParsedBookmark:
    url: str
    title: str
    add_date: datetime | None = None
    description: str | None = None
    folders: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)

    def all_tags(self) -> list[str]:
        """Folder path + explicit TAGS, de-duplicated preserving order."""
        seen: dict[str, None] = {}
        for name in [*self.folders, *self.tags]:
            key = name.strip()
            if key:
                seen.setdefault(key, None)
        return list(seen.keys())


def _parse_add_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        value = int(raw)
    except ValueError:
        return None
    # ADD_DATE is unix seconds; some exports use microseconds — normalize.
    if value > 10_000_000_000:  # ~ year 2286 in seconds → must be microseconds
        value //= 1_000_000
    try:
        return datetime.fromtimestamp(value, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None


def parse_netscape(html: str) -> list[ParsedBookmark]:
    """Extract every web bookmark with its folder path.

    The Netscape format leaves <DT>/<DD> unclosed, so HTML parsers nest tags
    unpredictably; relying on <DT> boundaries is unreliable. Instead we take
    every <A> and derive its folder path from its <DL> ancestors — each folder
    <DL> is labeled by the <H3> immediately preceding it.
    """
    soup = BeautifulSoup(html, "html.parser")
    results: list[ParsedBookmark] = []
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip()
        if not href.lower().startswith(("http://", "https://")):
            continue  # only web bookmarks (spec scope)
        tags_attr = a.get("tags", "")
        dd = a.find_next_sibling("dd")
        results.append(
            ParsedBookmark(
                url=href,
                title=a.get_text(strip=True) or href,
                add_date=_parse_add_date(a.get("add_date")),
                description=dd.get_text(strip=True) if dd is not None else None,
                folders=_folders_for(a),
                tags=[t.strip() for t in tags_attr.split(",") if t.strip()],
            )
        )
    return results


def _folders_for(a) -> list[str]:
    """Folder path (outermost → innermost) from the <A>'s <DL> ancestors."""
    names: list[str] = []
    for parent in a.parents:
        if parent.name == "dl":
            h3 = parent.find_previous_sibling("h3")
            if h3 is not None:
                text = h3.get_text(strip=True)
                # Skip non-organising browser container folders (FR-014).
                if text and text.lower() not in WRAPPER_FOLDERS:
                    names.append(text)
    names.reverse()
    return names
