# Design-decision record — Bookmarks app (Cycle 1)

Built from approved scenarios SCN-001..021. Production code only; prototype code
in /work/prototypes is NOT reused (per project rules).

## Stack
- Runtime: Node.js 24, Express (HTTP + REST API + static frontend).
- Persistence: single JSON file (`implementation/data/store.json`) holding
  bookmarks, collections and settings. Rationale: single-user personal app,
  modest scale; avoids native build deps and keeps data portable/inspectable.
  (Alternative dropped: SQLite/better-sqlite3 — native build, unnecessary at this
  scale.)
- HTML parsing (import + page-metadata extraction): `node-html-parser` (pure JS).
  (Alternative dropped: cheerio — heavier; jsdom — heavy/native-ish.)
- Frontend: vanilla JS single page (no framework) served statically. Search,
  filtering, sorting, paging and selection run client-side over the loaded set
  for responsiveness; mutations persist via the API.
- Tests: Node built-in `node:test` for unit/integration (search parser, URL
  normalization/dedupe, import/export); Playwright 1.61.0 for Gherkin-based
  acceptance flows.

## External-service handling (honest degradation)
- Metadata (real favicon URL, og:image preview, title/description): server fetches
  the page; on failure falls back (title = host) — SCN-009, SCN-021.
- Local snapshot: server fetches and stores page HTML (self-contained best-effort)
  or the PDF bytes for PDFs; failure returns a clear reason, bookmark untouched —
  SCN-018.
- Internet Archive: server calls the Wayback "save" endpoint; requires explicit
  public-confirmation from client before calling — SCN-018.
- When outbound network is unavailable, these endpoints return a clear error and
  the UI shows the graceful fallback/failure state. This is reported honestly, not
  masked as success.

## Key shared rules
- URL normalization / dedupe key (SCN-008, SCN-012): scheme-insensitive, host
  lowercased & `www.` stripped for the key, single trailing slash on path ignored,
  query string significant. Storage prefers https on http/https conflict.
- Address uniqueness enforced on create and on address-edit (SCN-015).
- Search grammar (SCN-003/005): terms, "phrases", #tags, AND/OR/NOT, parentheses,
  implicit AND; operators literal inside quotes; incomplete query flagged, not
  guessed. Case-insensitive over url+title+description+note.

## Data model (bookmark)
id, url, title, description, note, tags[], readLater, archived, addedAt,
updatedAt, favicon{real?url, fallback{letter,color}}, preview{url|null},
snapshot{status,at,kind:page|pdf,reason?}, archiveUrl|null.

settings: defaultSort, autoLocalCopy, textSize, perPage.
collections: [{id, name, query, tags[]}].
