"""Search query parsing and matching (FR-009).

Query language (deliberately tiny):
- Text inside double quotes is an exact-phrase term (internal spaces preserved).
- Bare words are individual terms.
- All terms must match (AND). A term matches if it is a case-insensitive
  substring of ANY single field (title, url, description, notes, or a tag name).
  Matching per-field (not a joined blob) prevents a phrase from falsely
  spanning two fields.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..models import Bookmark

_PHRASE_RE = re.compile(r'"([^"]*)"')


def parse_query(q: str | None) -> list[str]:
    """Return lowercased terms (phrases keep their spaces). Empty when no query."""
    if not q or not q.strip():
        return []
    terms: list[str] = []
    remainder = q
    for match in _PHRASE_RE.finditer(q):
        phrase = match.group(1).strip().lower()
        if phrase:
            terms.append(phrase)
    # Remove quoted sections, then split the rest into words.
    remainder = _PHRASE_RE.sub(" ", remainder)
    for word in remainder.split():
        word = word.strip().lower()
        if word:
            terms.append(word)
    return terms


def bookmark_matches(bookmark: "Bookmark", terms: list[str]) -> bool:
    """True if every term is found in at least one of the bookmark's fields."""
    if not terms:
        return True
    fields = [
        bookmark.title or "",
        bookmark.url or "",
        bookmark.description or "",
        bookmark.notes or "",
    ]
    fields.extend(tag.name for tag in bookmark.tags)
    fields_lower = [f.lower() for f in fields]
    return all(any(term in field for field in fields_lower) for term in terms)
