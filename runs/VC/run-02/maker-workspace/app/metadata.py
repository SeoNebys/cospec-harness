"""Fetch page metadata (title + favicon) for a URL, with graceful fallbacks."""
import re
from urllib.parse import urlparse

import httpx

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def normalize_url(url: str) -> str:
    """Ensure the URL has a scheme so it's a valid, clickable link."""
    url = url.strip()
    if not url:
        return url
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url):
        url = "https://" + url
    return url


def favicon_for(url: str) -> str:
    """Use Google's favicon service — works without parsing the page."""
    domain = urlparse(url).netloc
    if not domain:
        return ""
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=32"


async def fetch_metadata(url: str) -> tuple[str, str]:
    """Return (title, favicon_url). Falls back to the domain name if fetch fails."""
    favicon = favicon_for(url)
    fallback_title = urlparse(url).netloc or url
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=8.0,
            headers={"User-Agent": "Mozilla/5.0 (BookmarksApp)"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            match = _TITLE_RE.search(resp.text)
            if match:
                # Collapse whitespace and unescape common HTML entities.
                title = re.sub(r"\s+", " ", match.group(1)).strip()
                title = (
                    title.replace("&amp;", "&")
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&quot;", '"')
                    .replace("&#39;", "'")
                )
                if title:
                    return title, favicon
    except Exception:
        pass
    return fallback_title, favicon
