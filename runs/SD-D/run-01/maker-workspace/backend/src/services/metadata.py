"""Best-effort, time-boxed capture of a page's title, description, and favicon (FR-002/a).

Fetching is deliberately forgiving: any failure (timeout, network error, missing element)
simply leaves that field empty so saving still succeeds (spec "unreachable page" edge case
and SC-001: never block the save on a slow site).
"""

from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin

import httpx

FETCH_TIMEOUT_SECONDS = 5.0
_USER_AGENT = "BookmarkManager/1.0 (+local)"


@dataclass
class PageMetadata:
    title: str | None = None
    description: str | None = None
    favicon: bytes | None = None
    favicon_mime: str | None = None


class _MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title: str | None = None
        self.description: str | None = None
        self.icon_href: str | None = None
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        d = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = (d.get("name") or d.get("property") or "").lower()
            if key in ("description", "og:description") and d.get("content") and not self.description:
                self.description = d["content"].strip()
        elif tag == "link":
            rel = d.get("rel", "").lower()
            if "icon" in rel and d.get("href") and not self.icon_href:
                self.icon_href = d["href"]

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title and not self.title and data.strip():
            self.title = data.strip()


def fetch_metadata(url: str) -> PageMetadata:
    meta = PageMetadata()
    try:
        with httpx.Client(
            timeout=FETCH_TIMEOUT_SECONDS,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            resp = client.get(url)
            resp.raise_for_status()

            parser = _MetadataParser()
            parser.feed(resp.text)
            meta.title = parser.title
            meta.description = parser.description

            icon_url = (
                urljoin(str(resp.url), parser.icon_href)
                if parser.icon_href
                else urljoin(str(resp.url), "/favicon.ico")
            )
            _fetch_favicon(client, icon_url, meta)
    except Exception:
        # Best-effort only — leave whatever was captured (possibly nothing).
        pass
    return meta


def _fetch_favicon(client: httpx.Client, icon_url: str, meta: PageMetadata) -> None:
    try:
        resp = client.get(icon_url)
        if resp.status_code == 200 and resp.content:
            meta.favicon = resp.content
            meta.favicon_mime = resp.headers.get(
                "content-type", "image/x-icon"
            ).split(";")[0].strip()
    except Exception:
        pass
