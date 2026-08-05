"""Unit tests — query parsing (FR-009) and tag canonicalization (FR-004a)."""

from __future__ import annotations

from src.models import Tag
from src.services.search import parse_query


def test_parse_bare_words_lowercased():
    assert parse_query("Chicken Recipe") == ["chicken", "recipe"]


def test_parse_quoted_phrase_kept_intact():
    terms = parse_query('"exact phrase" extra')
    assert "exact phrase" in terms
    assert "extra" in terms


def test_parse_empty_is_no_terms():
    assert parse_query(None) == []
    assert parse_query("   ") == []


def test_tag_canonical_normalizes_case_and_whitespace():
    assert Tag.canonical(" Recipe ") == "recipe"
    assert Tag.canonical("RECIPE") == Tag.canonical("recipe")
