"""URL validation and normalization (research §8).

Normalization gives each bookmark a stable identity so that trivial variants
(``http://Example.com/`` vs ``http://example.com``) are treated as the same link,
without over-merging genuinely different pages (query/fragment are preserved).
"""

from urllib.parse import urlsplit, urlunsplit

_DEFAULT_PORTS = {"http": 80, "https": 443}


def is_valid_http_url(url: str) -> bool:
    """True only for well-formed http/https URLs with a host (FR-003)."""
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return False
    return parts.scheme in ("http", "https") and bool(parts.hostname)


def normalize_url(url: str) -> str:
    """Return a normalized form used as the uniqueness key.

    - lowercases scheme and host
    - drops the default port for the scheme
    - strips a trailing slash from the path (root path becomes empty)
    - preserves path, query, and fragment otherwise
    """
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()
    host = (parts.hostname or "").lower()

    netloc = host
    if parts.port is not None and parts.port != _DEFAULT_PORTS.get(scheme):
        netloc = f"{host}:{parts.port}"

    path = parts.path
    if path.endswith("/") and path != "/":
        path = path.rstrip("/")
    if path == "/":
        path = ""

    return urlunsplit((scheme, netloc, path, parts.query, parts.fragment))
