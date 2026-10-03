# Design decisions — cycle 1

Built fresh from the approved GWT scenarios (SCN-001..SCN-022), not from the
Phase 1 prototype.

## Architecture
- **Node.js + Express** single service. Serves the static web app (`public/`) and
  a JSON API. Chosen for simplicity and because the app is a single-user tool.
- **Durable private storage** = one JSON document written atomically
  (`lib/store.js`, temp file + rename). Satisfies the cross-cutting "private to
  me and persists between visits" assumption without a database dependency.
  Alternative dropped: SQLite (needs a native build; unnecessary for one user).
- **View logic on the client** (search, sort, paging, text size): the whole
  collection is loaded via `/api/state`, so filtering/sorting is instant and
  offline-capable. Mutations go to the server and the client reloads state, so
  the durable store is always the source of truth.
- **Shared search module** (`lib/search.js`) is a universal module served to the
  browser at `/vendor/search.js` and `require`d in tests — one source of truth
  for the query language (SCN-009), avoiding a second divergent parser.

## Metadata & images (SCN-001, SCN-002, SCN-015)
- `lib/metadata.js` fetches the page server-side (avoids browser CORS limits) and
  extracts og:title/description/image, `<title>`, meta description, and the
  declared favicon (falling back to `/favicon.ico`). PDFs detected by extension
  or content-type. Failure returns `ok:false` so the UI can offer manual entry
  and never block saving. The browser shows a letter avatar if an icon fails to
  load, and "No preview image available" when there is none.

## Preserved copy (SCN-019)
- `lib/archive.js`: ordinary pages saved as a local HTML copy with a `<base>` so
  it is readable independently; PDFs saved as the file bytes. Served back at
  `/api/bookmarks/:id/copy`. Best-effort: a capture failure still leaves the
  bookmark saved (just without a "Saved copy" action). The Internet Archive
  option builds the `web.archive.org` link and fires a best-effort Wayback save
  request; it is off by default, "keep a copy" is on by default.

## Same-address rule (SCN-003, SCN-021 dedupe)
- `SAME_ADDRESS` ignores a trailing slash and a leading `www.` — used for
  duplicate detection on save and skip-on-import.

## Status vs archive (SCN-004, SCN-006)
- A bookmark has an independent reading `status` ('toread'|'done') and an
  `archived` flag. Archiving never changes status, so restore returns to the
  remembered status. Bulk archive preserves each item's own status.

## Notes (SCN-018)
- Rendered by a small Markdown converter that HTML-escapes first, so notes can
  never execute active content. Supported: bold, italic, inline code, bullet
  lists, small headings, http(s) links.

## Preferences & saved searches (SCN-014, SCN-020, SCN-022)
- `prefs` (sortKey, pageSize, textSize) and `savedSearches` (name, query, view)
  persist in the same store. A saved search stores the query and view and is
  re-evaluated live against current bookmarks on each use (not a frozen list).
</content>
