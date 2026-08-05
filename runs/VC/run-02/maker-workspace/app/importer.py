"""Parse a Netscape 'bookmarks.html' export (Chrome, Firefox, Safari, Edge, …).

The format is a nested list of folders and links:

    <DL><p>
        <DT><H3>Folder</H3>
        <DL><p>
            <DT><A HREF="https://example.com">Title</A>
        </DL><p>
    </DL><p>

We track the folder nesting so folder names can become tags.
"""
from html.parser import HTMLParser
from html import unescape


class _BookmarkParser(HTMLParser):
    def __init__(self, folders_as_tags: bool):
        super().__init__()
        self.folders_as_tags = folders_as_tags
        self.links: list[dict] = []
        self._folder_stack: list[str | None] = []
        self._pending_folder: str | None = None
        # When inside an <h3> or <a>, capture text into the right target.
        self._capture: str | None = None  # "folder" or "link"
        self._current_link: dict | None = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "h3":
            self._capture = "folder"
            self._pending_folder = ""
        elif tag == "dl":
            # Entering a nested list: the most recent H3 names this folder.
            self._folder_stack.append(self._pending_folder)
            self._pending_folder = None
        elif tag == "a":
            attr = {k.lower(): (v or "") for k, v in attrs}
            href = attr.get("href", "").strip()
            if not href:
                return
            tags: list[str] = []
            if self.folders_as_tags:
                tags.extend(f for f in self._folder_stack if f)
            # Firefox stores per-link tags in a TAGS="a,b" attribute.
            if attr.get("tags"):
                tags.extend(t.strip() for t in attr["tags"].split(",") if t.strip())
            self._current_link = {"url": href, "title": "", "tags": tags}
            self._capture = "link"

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "h3":
            self._capture = None
        elif tag == "dl":
            if self._folder_stack:
                self._folder_stack.pop()
        elif tag == "a":
            if self._current_link is not None:
                self._current_link["title"] = self._current_link["title"].strip()
                self.links.append(self._current_link)
                self._current_link = None
            self._capture = None

    def handle_data(self, data):
        if self._capture == "folder":
            self._pending_folder = (self._pending_folder or "") + data
        elif self._capture == "link" and self._current_link is not None:
            self._current_link["title"] += data


def parse_bookmarks(html: str, folders_as_tags: bool = True) -> list[dict]:
    """Return a list of {url, title, tags} parsed from an export file."""
    parser = _BookmarkParser(folders_as_tags)
    parser.feed(html)
    # Unescape entities collected as raw text/attributes.
    for link in parser.links:
        link["title"] = unescape(link["title"])
        link["url"] = unescape(link["url"])
    return parser.links
