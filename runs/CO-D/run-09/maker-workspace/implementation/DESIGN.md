# Design decisions — Calm Bookmarks (Cycle 1)

Production implementation of the behaviour approved in Phase 1 (SCN-001..SCN-022).
Built independently from the Phase 1 prototype; behaviour carried forward via the
approved scenarios' GWT.

## Stack
- **Node.js + Express** single server: serves the static frontend and a small REST API.
  Chosen for zero-config availability in the shared image and no build step.
- **Persistence: a JSON file store** (`lib/store.js`, `data/db.json`) holding
  `{ bookmarks, collections, prefs }`. Single-user app → synchronous file IO is
  simple and sufficient. Alternative dropped: SQLite (native build, unneeded at this scale).
- **Search/filter/sort/paginate run in the browser** for a live, instant feel; the
  server owns durable data and network-dependent work. Alternative dropped: server-side
  query endpoint (adds latency to live typing).

## Key modules
- `public/query.js` — the search query language (words, `#labels`, `"phrases"`,
  `AND/OR/NOT`, parentheses). Shared by browser and Node unit tests. Precedence
  NOT > AND > OR; unparseable input falls back to plain all-words AND.
- `public/format.js` — safe lightweight note formatter (escape-first, then headings,
  bold, italic, lists, inline code, links). Shared by browser and tests.
- `lib/bookmarksHtml.js` — Netscape bookmark HTML import/export; folder + TAGS →
  labels, merged case-insensitively; dates preserved.
- `lib/metadata.js` — page metadata auto-fill, preserved-copy capture (HTML with an
  absolute `<base>` so it stays viewable; PDFs stored as-is), best-effort Internet
  Archive submission. All network work degrades gracefully to a retryable state.
- `lib/store.js` — persistence + URL helpers (`normUrl`, `looksLikeLink`, `domainOf`).
- `server.js` — REST API wiring the above.
- `public/app.js` — the frontend: editor, list, search, collections, bulk bar,
  archive view, display panel, import/export.

## Notable behavioural decisions (from Phase 1 approvals)
- Duplicate detection & clash safeguard use `normUrl` (ignores scheme, leading `www.`,
  trailing slash, case) — SCN-003/004/021.
- Archive is separate from Finished: archived links are excluded from the normal list
  and search; only the Archived view shows them — SCN-017.
- "Keep a viewable copy" defaults on; Internet Archive is opt-in and labelled public —
  SCN-020. Capture failure still saves the bookmark and offers retry.
- Preferences (sort, items-shown, text size) persist server-side in `prefs` — SCN-014/022.
- "Select all in this view" selects every match, not just the shown page — SCN-016/022.

## Network dependency (honest note)
Auto-fill, preserved-copy capture, and Internet Archive submission require outbound
network. When a page cannot be fetched, the app follows the approved failure paths
(manual title on save; retryable copy). Acceptance tests use deterministic local
fixtures under `public/fixtures/` to avoid external dependencies.

## Tests
- Unit (`node --test test/unit/*.test.js`): query language, note formatter, bookmark
  HTML import/export, URL helpers.
- Acceptance (`npx playwright test`): Gherkin-based, drives the real app across
  SCN-001..SCN-022 using local fixtures.
