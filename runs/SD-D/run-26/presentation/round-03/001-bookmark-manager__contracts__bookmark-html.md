# Bookmark HTML Interchange Contract

**Contract version**: 1  
**Media type**: `text/html`  
**Character encoding for exports**: UTF-8

## Compatibility Goal

The app accepts and emits the de facto Netscape/browser bookmark HTML dialect used by major browsers. Generic compatible tools must see every exported title and HTTP(S) address. Direct export from this app followed by direct import into an empty copy of this app must also restore the app-specific fields required by FR-042.

The format is historical rather than a formal standard. Import therefore tolerates omitted closing tags, case variation, unknown attributes, and ordinary malformed nesting within configured size/depth limits.

## Export Structure

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmark Manager Export</TITLE>
<H1>Bookmark Manager Export</H1>
<DL><p>
  <DT><H3>Active</H3>
  <DL><p>
    <DT><A HREF="https://example.com/"
           ADD_DATE="1700000000"
           LAST_MODIFIED="1700000100"
           TAGS="research,example"
           ICON="data:image/png;base64,..."
           DATA-BOOKMARK-MANAGER-META="eyJ2IjoxLC4uLn0">Example</A>
    <DD>Example page description
  </DL><p>
  <DT><H3>Archive</H3>
  <DL><p>...</DL><p>
</DL><p>
```

### Standard-facing fields

- `HREF`: required escaped serialized HTTP(S) URL.
- Anchor text: escaped bookmark display title; if no title exists, use the URL.
- `ADD_DATE`: saved time as nonnegative Unix seconds when representable.
- `LAST_MODIFIED`: updated time as nonnegative Unix seconds when representable.
- `TAGS`: comma-separated display tag names for tools that recognize the convention. Commas within tag names are escaped in the app extension, which is authoritative on app re-import.
- `ICON`: optional validated local raster encoded as a bounded data URL. Never emit a remote icon URL.
- `DD`: escaped page description. Personal notes are not exposed here because they may contain formatting and are carried losslessly in the app extension.

All text and attribute values are HTML-escaped. Active and archived bookmarks occupy separate top-level folders, and each bookmark appears exactly once regardless of tag count.

## App Extension

`data-bookmark-manager-meta` contains base64url-encoded UTF-8 JSON. Unknown versions or invalid schemas are ignored with a warning; the standard-facing bookmark remains importable.

Decoded version 1 shape:

```json
{
  "v": 1,
  "description": "Page description",
  "noteMarkdown": "**Remember** this",
  "tags": ["Research", "Example"],
  "isRead": false,
  "isArchived": false,
  "createdAt": "2026-09-27T12:00:00.000Z",
  "updatedAt": "2026-09-27T12:05:00.000Z",
  "iconChoice": "automatic"
}
```

Rules:

- Database IDs, session data, metadata error details, remote response bodies, and job state are never exported.
- The app extension tag array is authoritative for recognized app exports; the synthetic Active/Archive folders do not become tags.
- `ICON` contains the icon bytes needed for round-trip restoration. If absent or invalid, the app restores `iconChoice` and may safely re-enrich later.
- Generic tools may discard the app extension during their own import/export cycle; lossless app state is guaranteed only for direct app-export to app-import.

## Import Parsing

1. Enforce upload byte and nesting limits before/during parse.
2. Detect BOM/declared encoding and decode to Unicode; exports are always UTF-8.
3. Tokenize inertly. Never render the file, execute scripts, resolve links, or fetch file resources.
4. Maintain a folder stack from `H3` plus nested `DL` structure. `H1` and the synthetic document root are not tags.
5. For each anchor, validate an absolute HTTP(S) `HREF`, convert anchor and `DD` content to bounded plain text, and validate optional timestamps/icons.
6. For generic files, union nonempty ancestor folder names with `TAGS`, trimming and case-insensitively deduplicating them.
7. For a recognized valid app extension, use its tag/read/archive/note/timestamp fields and do not add synthetic Active/Archive folder names.
8. Compare the shared `url_key` with both active and archived library records and earlier valid entries in this file. The first valid occurrence wins; later occurrences are duplicate preview entries.
9. Invalid optional metadata creates a warning and fallback. An invalid/missing/non-HTTP(S) address makes the entry invalid.
10. Persist only parsed staging fields. Raw imported HTML and unrecognized extension data are discarded.

## Preview and Confirmation

- Preview reports `new`, `duplicate`, and `invalid` counts plus bounded entry details and reason codes.
- Preview does not mutate bookmarks, tags, icons, or enrichment jobs.
- Confirmation rechecks URL uniqueness inside its transaction because the library may have changed since preview.
- Cancellation or expiry deletes staged records and leaves the library unchanged.
- Confirmed generic imports are active and unread. Valid recognized app exports restore their recorded read/archive state.
- Missing description/icon work is queued after commit and cannot delay availability of imported bookmarks.

## Limits

Initial implementation limits, validated by performance tests:

- Maximum upload: 25 MiB.
- Maximum bookmark anchors: 25,000 (the required 10,000 remains within the supported range).
- Maximum folder depth: 100.
- Maximum decoded app extension per bookmark: 128 KiB.
- Individual text and icon fields use the entity limits in `data-model.md`.

Exceeding a limit rejects the preview with an actionable error and no library mutation.
