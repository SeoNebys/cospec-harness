"""Sanitize rich-text notes to a safe allowlist and extract plain text for search.

Notes support basic formatting only — links, bold, and bullet/numbered lists (FR-015).
Anything outside the allowlist is stripped before persistence.
"""

from html.parser import HTMLParser

import bleach

ALLOWED_TAGS = ["a", "b", "strong", "i", "em", "u", "p", "br", "ul", "ol", "li"]
ALLOWED_ATTRS = {"a": ["href", "title", "rel", "target"]}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_note_html(html: str | None) -> str | None:
    if not html:
        return None
    cleaned = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    ).strip()
    return cleaned or None


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if text:
            self._chunks.append(text)

    @property
    def text(self) -> str:
        return " ".join(self._chunks)


def extract_text(html: str | None) -> str | None:
    """Plain-text content of a note, used to keep search formatting-agnostic."""
    if not html:
        return None
    parser = _TextExtractor()
    parser.feed(html)
    return parser.text or None
