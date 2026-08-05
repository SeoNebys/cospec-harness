"""Unit tests for URL validation and normalization."""

import pytest

from src.services.url_utils import is_valid_http_url, normalize_url


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://example.com", True),
        ("http://example.com/path?q=1", True),
        ("ftp://example.com", False),
        ("not a url", False),
        ("", False),
        ("javascript:alert(1)", False),
        ("https://", False),
    ],
)
def test_is_valid_http_url(url, expected):
    assert is_valid_http_url(url) is expected


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("https://Example.com/", "https://example.com"),
        ("https://example.com:443/path/", "https://example.com/path"),
        ("http://example.com:80", "http://example.com"),
        ("https://example.com/a/b/", "https://example.com/a/b"),
        ("https://example.com/?x=1#frag", "https://example.com/?x=1#frag".replace("/?", "?")),
        ("HTTP://EXAMPLE.COM/Path", "http://example.com/Path"),
    ],
)
def test_normalize_url(raw, expected):
    assert normalize_url(raw) == expected


def test_normalize_preserves_query_and_fragment():
    assert normalize_url("https://e.com/p?a=1&b=2#top") == "https://e.com/p?a=1&b=2#top"


def test_variants_normalize_equal():
    assert normalize_url("https://Example.com/") == normalize_url("https://example.com")
