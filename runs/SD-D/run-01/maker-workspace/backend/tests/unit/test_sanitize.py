"""Unit tests for note sanitization and text extraction."""

from src.services.sanitize import extract_text, sanitize_note_html


def test_keeps_allowed_formatting():
    html = "<p><b>bold</b> <i>italic</i> <ul><li>one</li></ul></p>"
    out = sanitize_note_html(html)
    assert "<b>bold</b>" in out
    assert "<li>one</li>" in out


def test_keeps_links_with_href():
    out = sanitize_note_html('<a href="https://x.example">link</a>')
    assert "href" in out
    assert "https://x.example" in out


def test_strips_scripts_and_handlers():
    out = sanitize_note_html('<p onclick="evil()">hi<script>alert(1)</script></p>')
    assert "<script>" not in out
    assert "onclick" not in out


def test_drops_javascript_protocol_link():
    out = sanitize_note_html('<a href="javascript:alert(1)">x</a>')
    assert "javascript:" not in (out or "")


def test_empty_and_none():
    assert sanitize_note_html(None) is None
    assert sanitize_note_html("") is None


def test_extract_text_ignores_markup():
    assert extract_text("<p>hello <b>world</b></p>") == "hello world"
    assert extract_text(None) is None
