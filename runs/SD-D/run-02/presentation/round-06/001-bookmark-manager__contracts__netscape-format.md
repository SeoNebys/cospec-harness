# Netscape Bookmark File Contract

**Feature**: 001-bookmark-manager | Implements FR-035–FR-037, SC-007.
Import and export use the standard **Netscape Bookmark File Format** — the
`bookmarks.html` format that Chrome, Firefox, Safari, and Edge export and import.

## Shape

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com/article"
           ADD_DATE="1758018000"
           TAGS="reading,js">Example Article</A>
    <DT><A HREF="https://example.org" ADD_DATE="1758018100">Example</A>
</DL><p>
```

## Field mapping

| Netscape attribute / node | Bookmark field | Direction |
|---------------------------|----------------|-----------|
| `A` element text | `title` | import ⇄ export |
| `HREF` | `url` (then normalized → `url_key`) | import ⇄ export |
| `ADD_DATE` (Unix epoch **seconds**) | `date_added` | import ⇄ export (FR-035/036) |
| `TAGS` (comma-separated) | `tags` (resolved to shared identities) | import ⇄ export |

Notes:
- On **import**, `ADD_DATE` is converted from epoch seconds to ISO 8601 and
  preserved (FR-035); a missing `ADD_DATE` defaults to import time. Tags in
  `TAGS` are split on commas, trimmed, and resolved by shared identity (FR-008a).
  Folder structure (`<H3>` headings) is read leniently and does not block import;
  v1 does not model folders (tags are the organizing mechanism).
- On **import**, entries whose normalized URL already exists are **skipped** (no
  duplicates, FR-035/FR-006); the response reports `imported` vs `skipped`.
- On **export**, every non-… bookmark is written with `HREF`, link text
  (`title`), `ADD_DATE` (epoch seconds), and `TAGS` (FR-036), producing a file
  that re-imports into mainstream browsers and back into this app (SC-007).

## Validation (FR-037)

A file is accepted only if it parses as a Netscape bookmark document (has the
`NETSCAPE-Bookmark-file` doctype/`<DL>` structure with `<A HREF>` entries). A
malformed or unrelated file is **rejected whole** with
`400 invalid_bookmark_file`; nothing is imported and the collection is unchanged.
