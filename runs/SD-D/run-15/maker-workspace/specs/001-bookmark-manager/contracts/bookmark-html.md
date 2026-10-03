# Contract: Browser-Bookmark HTML (import / export)

Implements FR-033/FR-034 and SC-008 using the standard Netscape "Bookmark File" format that
browsers read and write.

## Export format
A `NETSCAPE-Bookmark-file-1` document with a `<DL>` list. Each bookmark is a `<DT><A>` whose
attributes preserve the fields the client asked to keep:

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com/article"
           ADD_DATE="1716500000"
           TAGS="reading,work">How to Do the Thing</A>
    <DT><A HREF="https://example.org/" ADD_DATE="1716400000" TAGS="reference">Example</A>
</DL><p>
```

- **HREF** → bookmark address.
- **Link text** → title (FR-033).
- **ADD_DATE** → original date added, Unix seconds (FR-033; preserved on round-trip, SC-008).
- **TAGS** → comma-separated tag names (FR-033). Widely used by browsers/services for tags.

## Import parsing
Parse with an HTML parser and, for each `<A>`:
- Read `HREF` as the address; normalize a missing scheme (FR-004).
- Use the link text as the title (FR-034).
- Read `ADD_DATE` (Unix seconds) as the original date added; if absent, use import time.
- Collect tags from **both** the `TAGS` attribute and any enclosing `<H3>` folder names
  (folder → tag mapping, FR-034).
- **Skip** an address already present in the collection (no duplicates, FR-034/SC-008).

Returns counts `{ added, skipped }`.

## Round-trip guarantee
Export → import of the same file preserves 100% of addresses, titles, tags, and original
dates added, and creates no duplicates (SC-008).
