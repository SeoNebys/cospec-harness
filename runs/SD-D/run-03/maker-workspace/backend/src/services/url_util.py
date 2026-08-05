"""URL validation and normalization (FR-002, FR-011).

Validation: only well-formed http/https addresses are accepted.
Normalization: lowercase the scheme and host and trim a trailing slash so that
trivially-different spellings of the same page collapse to one, backing the
uniqueness that powers "re-save opens existing" (FR-011) and import de-dupe.
"""

from __future__ import annotations

from urllib.parse import urlparse, urlunparse


class InvalidUrlError(ValueError):
    """Raised when a supplied address is not a well-formed http/https URL."""


def normalize_url(raw: str) -> str:
    """Validate and return a normalized URL, or raise InvalidUrlError."""
    if raw is None:
        raise InvalidUrlError("No address provided.")
    candidate = raw.strip()
    if not candidate:
        raise InvalidUrlError("No address provided.")

    parsed = urlparse(candidate)
    if parsed.scheme.lower() not in ("http", "https"):
        raise InvalidUrlError("Address must start with http:// or https://")
    if not parsed.netloc:
        raise InvalidUrlError("Address is missing a site name.")

    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    # Trim trailing slash(es) so "https://a.com/x" and "https://a.com/x/"
    # (and the bare "https://a.com/") collapse to the same address.
    path = parsed.path.rstrip("/")

    return urlunparse((scheme, netloc, path, parsed.params, parsed.query, parsed.fragment))
