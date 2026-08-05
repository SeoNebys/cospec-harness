"""Fetch the ``<title>`` of a web page.

Best-effort and defensive: network errors, timeouts, or missing titles
just yield an empty string so bookmark creation never fails because a
page couldn't be reached.
"""
from __future__ import annotations

from html.parser import HTMLParser

import httpx

_MAX_BYTES = 200_000  # don't read whole large pages; the <title> is near the top
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; BookmarkManager/1.0; +http://localhost)"
    )
}


class _TitleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self._done = False

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() == "title" and not self._done:
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False
            self._done = True

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


async def fetch_title(url: str) -> str:
    """Return the page title for ``url``, or ``""`` if unavailable."""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=8.0, headers=_HEADERS
        ) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                chunks: list[bytes] = []
                total = 0
                async for chunk in resp.aiter_bytes():
                    chunks.append(chunk)
                    total += len(chunk)
                    if total >= _MAX_BYTES:
                        break
                body = b"".join(chunks)
        text = body.decode(resp.encoding or "utf-8", errors="replace")
        parser = _TitleParser()
        parser.feed(text)
        return " ".join(parser.title.split()).strip()
    except Exception:
        return ""
