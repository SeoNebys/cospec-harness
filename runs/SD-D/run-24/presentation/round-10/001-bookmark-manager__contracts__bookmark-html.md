# Contract: Bookmark HTML Import/Export (Netscape format)

Governs interoperable import/export (FR-029/030/031, Q5). Uses the Netscape
Bookmark File format with the de-facto `TAGS` attribute for flat multi-tag
preservation.

## Export shape

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><A HREF="https://example.com/article"
         ADD_DATE="1758787200"
         TAGS="reading,tech">Example Article</A>
  <DT><A HREF="https://another.example/"
         ADD_DATE="1758790800"
         TAGS="news">Another</A>
</DL><p>
```

- `HREF` — the bookmark URL (as saved).
- `ADD_DATE` — saved date as Unix seconds (from `saved_at`).
- `TAGS` — comma-separated tag names; multiple tags on one entry (no folder
  duplication).
- `<A>` text content — the title.
- All bookmarks exported flat (archived items included, marked via a `TAGS`
  convention is out of scope; archive state is app-internal).

## Import parsing

For each `<A>` element:
- Read `HREF` (required; entries without a valid URL are counted `skippedInvalid`).
- Read `ADD_DATE` → `saved_at`; if absent, use import time.
- Read `TAGS` → split on comma, trim, drop empties → tag set; if absent, no tags.
- Element text → `title`; if empty, fall back to the URL.

## Merge rules (non-destructive, Q3 / FR-031)

Match incoming entries to existing bookmarks by `normalized_url`:

| Field | On existing match |
|-------|-------------------|
| tags | **union** incoming with existing |
| saved_at | keep the **earliest** of the two |
| title / description / note | **preserve existing**; only set if currently empty |
| read / archived states | unchanged |

Non-matching entries are inserted as new bookmarks. No duplicates are created for
already-saved addresses.

## Round-trip guarantee (SC-008)

Export → import of the same collection preserves 100% of titles, tags, and saved
dates and creates zero duplicates.
