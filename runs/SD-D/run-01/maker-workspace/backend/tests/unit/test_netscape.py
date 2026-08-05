"""Unit tests for the Netscape bookmark parser and writer."""

from dataclasses import dataclass
from datetime import datetime, timezone

import pytest

from src.services.netscape import (
    MalformedImportError,
    parse_netscape_bookmarks,
    write_netscape_bookmarks,
)

SAMPLE = """<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3 ADD_DATE="1500000000">Cooking</H3>
    <DL><p>
        <DT><A HREF="https://r.example/a" ADD_DATE="1500000123">Pancakes</A>
        <DT><H3>Desserts</H3>
        <DL><p>
            <DT><A HREF="https://r.example/b">Cake</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://top.example/">Top</A>
</DL><p>
"""


def test_parses_titles_and_urls():
    marks = {b.title: b for b in parse_netscape_bookmarks(SAMPLE)}
    assert set(marks) == {"Pancakes", "Cake", "Top"}
    assert marks["Pancakes"].url == "https://r.example/a"


def test_folders_map_to_tags_including_nested():
    marks = {b.title: b for b in parse_netscape_bookmarks(SAMPLE)}
    assert marks["Pancakes"].tags == ["Cooking"]
    assert marks["Cake"].tags == ["Cooking", "Desserts"]
    assert marks["Top"].tags == []


def test_add_date_parsed():
    marks = {b.title: b for b in parse_netscape_bookmarks(SAMPLE)}
    assert marks["Pancakes"].add_date.year == 2017
    assert marks["Cake"].add_date is None  # no ADD_DATE on Cake


def test_reads_tags_attribute_union_with_folders():
    html = '<DL><p><DT><H3>Work</H3><DL><p><DT><A HREF="https://x.example" TAGS="urgent,work">X</A></DL><p></DL><p>'
    b = parse_netscape_bookmarks(html)[0]
    assert b.tags == ["Work", "urgent"]  # folder + tag attr, deduped case-insensitively


def test_malformed_raises():
    with pytest.raises(MalformedImportError):
        parse_netscape_bookmarks("this is not a bookmark file")


@dataclass
class _Tag:
    name: str


@dataclass
class _BM:
    url: str
    title: str
    date_saved: datetime

    @property
    def tags(self):
        return self._tags

    def __init__(self, url, title, date_saved, tags):
        self.url = url
        self.title = title
        self.date_saved = date_saved
        self._tags = [_Tag(t) for t in tags]


def test_write_then_parse_roundtrip():
    dt = datetime(2020, 1, 1, tzinfo=timezone.utc)
    out = write_netscape_bookmarks([_BM("https://e.example/p", "Title & <stuff>", dt, ["a", "b"])])
    assert "NETSCAPE-Bookmark-file-1" in out
    parsed = parse_netscape_bookmarks(out)
    assert len(parsed) == 1
    assert parsed[0].url == "https://e.example/p"
    assert parsed[0].title == "Title & <stuff>"  # escaping round-trips
    assert set(parsed[0].tags) == {"a", "b"}


def test_write_empty_is_valid():
    out = write_netscape_bookmarks([])
    assert "NETSCAPE-Bookmark-file-1" in out
    assert parse_netscape_bookmarks(out) == []
