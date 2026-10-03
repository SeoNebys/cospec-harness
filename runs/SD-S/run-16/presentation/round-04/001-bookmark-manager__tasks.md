---

description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — the plan specifies unit (`node:test`), integration, and one Playwright e2e run.

**Organization**: Tasks are grouped by user story (US1 = P1, US2 = P2, US3 = P3) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- File paths are relative to repository root (`/work`)

## Path Conventions

Single web-application deployable per plan.md: `src/` (server), `public/` (frontend), `tests/`, `data/` (SQLite file at runtime).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure per plan.md: `src/models/`, `src/services/`, `src/routes/`, `public/`, `data/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`
- [X] T002 Initialize Node.js project: create `package.json` with `"type": "module"`, `"start": "node src/server.js"`, `"test": "node --test tests/unit tests/integration"` scripts; add dependencies `express@^5`, `better-sqlite3`, `cheerio`; add devDependency `@playwright/test@1.61.0` (pinned to match preinstalled browsers)
- [X] T003 [P] Add `.gitignore` (ignore `node_modules/`, `data/*.db`) and `playwright.config.js` pointing at `http://127.0.0.1:4000` with `webServer` running `npm start`
- [X] T004 Run `npm install` and confirm `better-sqlite3` builds against Node 24

**Checkpoint**: Project scaffolding exists and dependencies install cleanly

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement SQLite bootstrap in `src/db.js`: open/create `data/bookmarks.db`, enable `PRAGMA foreign_keys = ON`, and create schema per data-model.md — `bookmarks` (`id` PK, `url` text NOT NULL, `normalized_url` text NOT NULL UNIQUE, `title` text, `description` text, `favicon_url` text, `preview_image_url` text, `notes` text, `enrichment_status` text CHECK in (`pending`,`ready`,`failed`), `date_saved` text NOT NULL), `tags` (`id` PK, `name` text NOT NULL UNIQUE COLLATE NOCASE), `bookmark_tags` (`bookmark_id`, `tag_id`, PK `(bookmark_id, tag_id)`, both FK `ON DELETE CASCADE`)
- [X] T006 Create indexes in `src/db.js`: unique on `bookmarks.normalized_url`, index on `bookmarks.date_saved`, unique on `tags.name` (NOCASE), index on `bookmark_tags.tag_id`
- [X] T007 [P] Implement URL validation/normalization in `src/services/url.js`: `validateAndNormalize(input)` — default scheme-less input to `https://`, parse via WHATWG `URL`, require http/https protocol + non-empty host (else throw invalid), and return `{ url, normalizedUrl }` where `normalizedUrl` lowercases scheme+host, drops default port, removes trailing slash on empty path, preserves path/query (research §9)
- [X] T008 [P] Implement Express app assembly in `src/server.js`: create app, `express.json()` middleware, serve `public/` as static, mount `/api` router, centralized error handler emitting `{ error, message }`, and listen on `0.0.0.0:4000` (log start). Keep route wiring importable for in-process tests
- [X] T009 [P] Unit test URL rules in `tests/unit/url.test.js`: scheme-less → https, invalid input rejected, normalization equivalence (e.g. `HTTP://Example.com:80/` ≡ `http://example.com`)

**Checkpoint**: DB, URL rules, and server skeleton ready — user story implementation can begin

---

## Phase 3: User Story 1 - Save a bookmark (Priority: P1) 🎯 MVP

**Goal**: A user saves a web address; the bookmark persists and appears immediately with a URL-derived title, then the page's real title/description/favicon/preview fill in via background enrichment. Invalid addresses are rejected; duplicates route to editing the existing bookmark.

**Independent Test**: POST a valid URL → `201` with `enrichmentStatus: pending` and the item shown at top; shortly after, `GET` shows `ready` with real metadata (or `failed` with placeholders). POST an invalid URL → `400`. POST a duplicate → `409` with the existing bookmark.

### Tests for User Story 1 ⚠️ (write first, ensure they fail)

- [X] T010 [P] [US1] Integration test in `tests/integration/api.test.js`: `POST /api/bookmarks` with valid scheme-less URL returns `201`, `enrichmentStatus: "pending"`, URL-derived title, `dateSaved` set; invalid URL returns `400 invalid_url`; duplicate normalized URL returns `409` with `existing`. Inject a stub metadata fetcher so enrichment is deterministic/offline
- [X] T011 [P] [US1] Unit test metadata parsing in `tests/unit/metadata.test.js`: given fixture HTML, extract title (`og:title`→`<title>`→URL), description (`og:description`→meta description→empty), preview (`og:image`→`twitter:image`), favicon (`<link rel=icon>`→`/favicon.ico`), resolving relative URLs against the page URL (research §4)

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement metadata extraction in `src/services/metadata.js`: `fetchMetadata(url)` using global `fetch` + `AbortController` with an 8s timeout, a realistic `User-Agent`, only parsing `text/html` responses, capping body at ~512KB; parse with cheerio per the precedence in research §4; resolve relative favicon/image URLs against the final URL; return `{ title, description, faviconUrl, previewImageUrl }` or throw/timeout (research §5)
- [X] T013 [US1] Implement Bookmark data access in `src/models/bookmark.js`: `create({url, normalizedUrl, title, notes, tags})` inserting with `enrichment_status='pending'`, `date_saved=now` and upserting tags + join rows; `findByNormalizedUrl(normalizedUrl)`; `getById(id)` returning tags as a name array; `updateEnrichment(id, {title, description, faviconUrl, previewImageUrl, status})` that only overwrites title if not user-edited (set fetched title when current title is the URL-derived default)
- [X] T014 [US1] Implement background enrichment in `src/services/enrichment.js`: `enqueue(bookmarkId, url)` runs `fetchMetadata` off the request path, on success calls `updateEnrichment(..., status:'ready')`, on timeout/error sets `status:'failed'` keeping URL-derived title + null image; log outcome (success/timeout/failure). Accept an injectable fetcher for tests
- [X] T015 [US1] Implement `POST /api/bookmarks` in `src/routes/bookmarks.js`: validate+normalize URL (400 `invalid_url` on failure), dedupe via `findByNormalizedUrl` (return `409` `{error:"duplicate", existing}` if found, FR-011), else `create`, kick off `enrichment.enqueue`, and return `201` with the serialized bookmark (FR-001–FR-004, choice A)
- [X] T016 [US1] Implement `GET /api/bookmarks/:id` in `src/routes/bookmarks.js` returning the bookmark or `404` (used by the UI to poll enrichment status)
- [X] T017 [US1] Build the add-bookmark UI in `public/index.html` + `public/app.js` + `public/styles.css`: an add form (URL + optional notes/tags), on submit POST then optimistically prepend the returned bookmark showing a "fetching details…" state while `pending`, poll `GET /api/bookmarks/:id` until `ready`/`failed` and update the card in place; on `400` show an inline actionable error; on `409` open the existing bookmark's edit view (wired in US3). Set `data-harness-ready="true"` on the main container after the initial list load

**Checkpoint**: User Story 1 fully functional — save is instant, metadata fills in, invalid rejected, duplicate detected. MVP deliverable.

---

## Phase 4: User Story 2 - Browse, search, and open (Priority: P2)

**Goal**: List all bookmarks (most recent first), filter by keyword as the user types, filter by tag, show empty/no-results states, and open a bookmark's page in a new tab.

**Independent Test**: With several bookmarks saved, `GET /api/bookmarks` lists them newest-first; `?q=` narrows by title/url/description; `?tag=` narrows by tag; no matches → empty state; clicking a bookmark opens the original in a new tab.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Integration test in `tests/integration/api.test.js`: `GET /api/bookmarks` returns newest-first; `?q=` matches case-insensitive substrings of title/url/description; `?tag=` filters by tag; unmatched `q` returns empty array; `GET /api/tags` returns known tag names

### Implementation for User Story 2

- [X] T019 [US2] Extend `src/models/bookmark.js`: `list({q, tag})` building parameterized `WHERE` clauses — case-insensitive substring over title/url/description for `q`, join `bookmark_tags`/`tags` for `tag` — ordered `date_saved DESC` (FR-005, FR-007, FR-014); `listTags()` returning all tag names
- [X] T020 [US2] Implement `GET /api/bookmarks` (with `q`/`tag` query params) and `GET /api/tags` in `src/routes/bookmarks.js` per contracts/api.md
- [X] T021 [US2] Build list/search/filter UI in `public/app.js` + `public/index.html`: render bookmark cards (title link opening in a new tab via `target="_blank" rel="noopener"`, favicon, preview image, description, tags), a search box that re-queries as the user types (debounced), a tag filter control populated from `GET /api/tags`, and a clear empty state for both first-run (FR-008) and no-results

**Checkpoint**: Users can find and open bookmarks; US1 + US2 both work independently

---

## Phase 5: User Story 3 - Edit and delete (Priority: P3)

**Goal**: Edit a bookmark's title, description, address, notes, and tags (re-validating the URL); delete a bookmark behind an explicit confirmation. Also the destination of the duplicate-save flow (FR-011).

**Independent Test**: Edit a bookmark's title/description → persists across reload; deleting after confirmation removes it permanently; saving a duplicate URL opens this edit view on the existing item.

### Tests for User Story 3 ⚠️

- [X] T022 [P] [US3] Integration test in `tests/integration/api.test.js`: `PUT /api/bookmarks/:id` updates title/description/notes/tags and persists; editing `url` re-validates (400 on invalid), re-normalizes, resets `enrichment_status` to `pending`, and returns `409` if it collides with a different bookmark; `DELETE /api/bookmarks/:id` returns `204` and the item is gone (`404` on missing)

### Implementation for User Story 3

- [X] T023 [US3] Extend `src/models/bookmark.js`: `update(id, {url, normalizedUrl, title, description, notes, tags})` updating fields + re-syncing tag join rows; when `url`/`normalizedUrl` changes, reset `enrichment_status='pending'`; `remove(id)` deleting the bookmark (join rows cascade)
- [X] T024 [US3] Implement `PUT /api/bookmarks/:id` (validate URL, dedupe against *other* bookmarks → `409`, reset+re-enqueue enrichment when URL changed, `404` if missing) and `DELETE /api/bookmarks/:id` (`204`/`404`) in `src/routes/bookmarks.js` per contracts/api.md (FR-009, FR-010)
- [X] T025 [US3] Build edit/delete UI in `public/app.js` + `public/index.html`: an edit form pre-filled from a bookmark (title, description, url, notes, tags) that PUTs and updates the card; a delete action guarded by an explicit confirmation prompt (FR-010); wire US1's `409` duplicate response to open this edit view on the returned existing bookmark (FR-011)

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and delivery readiness

- [X] T026 [P] [US1] Write Playwright e2e in `tests/e2e/bookmarks.spec.js`: save a URL → appears immediately (pending) → enrichment fills in → search narrows → tag filter → edit persists → delete removes. Stub/intercept outbound metadata fetch for determinism
- [X] T027 Write `.harness/app.json` = `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` and confirm the server binds `0.0.0.0:4000` and serves `/`
- [X] T028 [P] Add a short `README.md` (run/test instructions from quickstart.md) and confirm long titles/URLs truncate in the UI (edge cases in spec)
- [X] T029 Run `npm test` and `npx playwright test`; then execute the quickstart.md validation scenarios end-to-end and fix any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: depend on Foundational; then orderable by priority P1 → P2 → P3
- **Polish (Phase 6)**: depends on the targeted stories being complete

### User Story Dependencies

- **US1 (P1)**: after Foundational. Self-contained MVP.
- **US2 (P2)**: after Foundational. Independent of US1 for its list/search API, though it displays US1-created data.
- **US3 (P3)**: after Foundational. Its edit view is also reused by US1's duplicate flow (T025 wires T017's `409` handler); implement US1 first for that wiring.

### Within Each User Story

- Tests first (and failing) → models → services → endpoints → UI
- `src/models/bookmark.js` is touched by US1/US2/US3 (T013, T019, T023) — those edits are sequential, not `[P]`

### Parallel Opportunities

- Setup: T003 [P]
- Foundational: T007, T008, T009 [P] after T005/T006
- US1 tests T010, T011 [P]; then T012 [P] (metadata) alongside model work
- Cross-story: US2 and US3 API/UI can proceed in parallel once US1 lands, respecting the shared-model note

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate** save + background enrichment + invalid/duplicate handling → demo.

### Incremental Delivery

Foundation → US1 (MVP, save+enrich) → US2 (browse/search/tags) → US3 (edit/delete + duplicate-to-edit) → Polish (e2e + harness + quickstart validation). Each story adds value without breaking the previous.

---

## Notes

- [P] = different files, no incomplete-task dependencies.
- Metadata fetching is injectable so unit/integration tests run offline and deterministically.
- Commit after each task or logical group.
- Enrichment must never block the `POST` response (choice A, SC-007).
