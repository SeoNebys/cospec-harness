"""Best-effort page metadata capture (FR-003).

Fetches the page with a short timeout and parses title, description, and a
favicon. Saving never waits on this: the API stores the bookmark immediately
and calls `enrich_bookmark` in the background. Every failure is swallowed so an
offline/blocked/slow page never breaks saving (spec edge case).
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from ..db import get_session
from ..models import Bookmark

FETCH_TIMEOUT_SECONDS = 3.0
_HEADERS = {"User-Agent": "BookmarkManager/0.1 (local)"}
# Cap cached icons so the local database stays small.
_MAX_ICON_BYTES = 100_000


@dataclass
class PageMetadata:
    title: str | None = None
    description: str | None = None
    icon: str | None = None


def fetch_metadata(url: str) -> PageMetadata:
    """Return whatever metadata could be read; never raises."""
    try:
        with httpx.Client(
            timeout=FETCH_TIMEOUT_SECONDS, follow_redirects=True, headers=_HEADERS
        ) as client:
            resp = client.get(url)
            resp.raise_for_status()
            html = resp.text
    except Exception:
        return PageMetadata()

    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return PageMetadata()

    icon_url = _extract_icon(soup, url)
    return PageMetadata(
        title=_extract_title(soup),
        description=_extract_description(soup),
        # Cache the icon locally as a data URI so the list renders with no
        # outbound requests (keeps the collection private; "all local").
        icon=_fetch_icon_data_uri(icon_url) if icon_url else None,
    )


def _extract_title(soup: BeautifulSoup) -> str | None:
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        return og["content"].strip()
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    return None


def _extract_description(soup: BeautifulSoup) -> str | None:
    for finder in (
        lambda: soup.find("meta", property="og:description"),
        lambda: soup.find("meta", attrs={"name": "description"}),
    ):
        tag = finder()
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def _extract_icon(soup: BeautifulSoup, page_url: str) -> str | None:
    link = soup.find("link", rel=lambda v: v and "icon" in v.lower())
    if link and link.get("href"):
        return urljoin(page_url, link["href"])
    # Fallback to the conventional /favicon.ico at the site root.
    parsed = urlparse(page_url)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
    return None


def _fetch_icon_data_uri(icon_url: str) -> str | None:
    """Download the favicon and return it as a data URI; never raises."""
    try:
        with httpx.Client(
            timeout=FETCH_TIMEOUT_SECONDS, follow_redirects=True, headers=_HEADERS
        ) as client:
            resp = client.get(icon_url)
            resp.raise_for_status()
            data = resp.content
    except Exception:
        return None
    if not data or len(data) > _MAX_ICON_BYTES:
        return None
    content_type = "image/x-icon"
    # Trust a sensible image content-type if provided.
    header = None
    try:
        header = resp.headers.get("content-type")
    except Exception:
        header = None
    if header and header.startswith("image/"):
        content_type = header.split(";")[0].strip()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def enrich_bookmark(bookmark_id: int, url: str) -> None:
    """Background task: fetch metadata and fill in blanks on the saved bookmark.

    Only fills fields the user has not already set: the title is overwritten
    only if it is still the url fallback; description/icon only if empty.
    """
    meta = fetch_metadata(url)
    if not (meta.title or meta.description or meta.icon):
        return
    with get_session() as session:
        bookmark = session.get(Bookmark, bookmark_id)
        if bookmark is None:
            return
        if meta.title and bookmark.title == bookmark.url:
            bookmark.title = meta.title
        if meta.description and not bookmark.description:
            bookmark.description = meta.description
        if meta.icon and not bookmark.icon:
            bookmark.icon = meta.icon
        session.add(bookmark)
        session.commit()
