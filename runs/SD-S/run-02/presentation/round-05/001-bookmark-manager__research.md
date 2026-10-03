# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the spec, the runtime
presentation environment (CLAUDE.md), and the shared image capabilities. No
`NEEDS CLARIFICATION` markers remained. Decisions below.

## Decision 1 — Application shape: Express service + static SPA

- **Decision**: One Node.js process using Express to serve a JSON REST API and
  the static frontend from `public/`.
- **Rationale**: The runtime environment requires a single foreground server
  started by `npm start` on `0.0.0.0:4000`. A single process serving both API
  and assets is the simplest thing that satisfies this and avoids CORS between
  frontend and API. Express is stable, minimal, and well understood on Node 24.
- **Alternatives considered**: Next.js / full framework (heavier build, more deps
  than a single-user app warrants); pure static app with client-only storage
  (rejected — enrichment needs a server to fetch cross-origin pages, and
  client-only storage complicates the "survives restart on the server" model).

## Decision 2 — Persistence: local SQLite via Node's built-in node:sqlite

- **Decision**: Store bookmarks and tags in a local SQLite file (`data/bookmarks.db`),
  accessed synchronously with Node 24's built-in `node:sqlite` (`DatabaseSync`),
  WAL mode enabled on-disk.
- **Rationale**: Single-user, local, must survive restart (FR-004). SQLite gives
  reliable persistence, relational tag modeling, and fast `LIKE`/indexed search
  well within SC-005 for hundreds–thousands of rows. A synchronous API keeps the
  single-user data layer simple.
- **Driver note**: The plan originally named `better-sqlite3`. It was replaced
  during implementation with the built-in `node:sqlite`: same synchronous shape
  (`prepare().get/all/run`, `@name` params), no native build step, and it avoids
  a native-addon finalizer assertion that made `node:test` teardown flaky.
  Behavior is identical; transactions use explicit `BEGIN`/`COMMIT`/`ROLLBACK`.
- **Alternatives considered**: JSON flat file (simpler but awkward for tag joins,
  search, and concurrent writes/durability); a client-side store like
  IndexedDB/localStorage (doesn't meet server-side persistence + enrichment
  needs). A server DB like Postgres is overkill for a single-user app.

## Decision 3 — Enrichment: server-side best-effort metadata fetch

- **Decision**: On save (and on explicit refresh), the server fetches the target
  URL with the built-in `fetch`, time-bounded (~5s) and size-capped, then parses
  the HTML with `node-html-parser` to extract, in priority order:
  - **Title**: `og:title` → `<title>` → user-entered → derived from URL.
  - **Description**: `og:description` → `meta[name=description]` → empty.
  - **Preview image**: `og:image` (absolute-resolved) → empty (placeholder in UI).
  - **Favicon**: `<link rel~=icon>` (absolute-resolved) → `/favicon.ico` guess.
  Stored values are URLs/text; images are referenced by URL, not downloaded.
- **Rationale**: Open Graph + standard meta tags are the widely-published
  convention (SC-006). Doing it server-side avoids browser cross-origin blocks.
  Best-effort with timeouts satisfies FR-007/FR-008: a failed/slow/large page
  never blocks or fails a save. Referencing image URLs (vs downloading) keeps the
  datastore small and the save fast.
- **Enrichment timing**: The save endpoint returns immediately after persisting
  the bookmark; enrichment runs and then updates the row. The frontend reflects
  enriched fields on the next fetch/poll of that bookmark. This keeps save
  latency low and honors "saving never blocks on enrichment."
- **Alternatives considered**: Client-side fetch (blocked by CORS); a third-party
  metadata API (spec explicitly assumes none); downloading/caching images
  locally (unnecessary storage/complexity for v1); headless-browser rendering for
  JS-only pages (heavy; most metadata is in initial HTML — deferred).

## Decision 4 — Duplicate handling: detect and route to edit

- **Decision**: Normalize URLs (lowercase scheme/host, strip default ports and
  trailing slash, keep path/query) and treat a save whose normalized URL already
  exists as a duplicate. The API responds with a signal identifying the existing
  bookmark's id; the frontend opens that bookmark in edit mode.
- **Rationale**: Directly implements FR-009 (guide-to-edit, not reject). URL
  normalization avoids trivial duplicates (`http://x.com` vs `http://x.com/`).
- **Alternatives considered**: Exact-string match only (misses trivial variants);
  silently updating the existing record (hides intent from the user).

## Decision 5 — Search & tag model

- **Decision**: Tags in a `tags` table with a `bookmark_tags` join; search is a
  case-insensitive substring match across title, url, description, note, and tag
  names, combinable with a tag filter. Tag suggestions come from distinct
  existing tag names.
- **Rationale**: Meets FR-010/FR-011/FR-016 and SC-003. A relational tag model
  enables reuse, suggestions, and filtering; substring search is ample at this
  scale. (Full-text search deferred; not needed for hundreds of rows.)
- **Alternatives considered**: Storing tags as a comma-joined string (hard to
  filter/suggest cleanly); SQLite FTS5 (more than needed at this scale).

## Decision 6 — Testing approach

- **Decision**: `node --test` for URL validation/normalization, metadata parsing
  (against saved HTML fixtures), and REST behavior against a temporary DB;
  Playwright 1.61.0 for an end-to-end smoke of save → list → edit/tag → search.
- **Rationale**: Matches the spec's testable requirements and the image's tooling
  (Playwright pinned to 1.61.0 to match the installed browser revision). Fixture
  HTML keeps enrichment tests deterministic and offline.
- **Alternatives considered**: Live network fetches in tests (flaky, non-hermetic).
