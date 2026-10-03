---
description: "Task list for Bookmark Manager implementation"
---

# Tasks: Bookmark Manager

**Input**: Design documents from `/specs/001-bookmark-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — plan.md defines a testing strategy (`node:test` unit/contract + Playwright 1.61.0 e2e). Test tasks are scoped per story.

**Organization**: Tasks are grouped by user story (priority order) so each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US8 map to spec.md user stories
- File paths follow the structure in plan.md (single web-app deployable)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and structure

- [ ] T001 Initialize Node project: create `package.json` (ES modules, `"type":"module"`) with scripts `start` (`node server.js`), `test` (`node --test`), `test:e2e` (playwright), and dependencies express, better-sqlite3, node-html-parser, playwright pinned to `1.61.0`; run `npm install` preserving the lockfile
- [ ] T002 Create the source tree per plan.md: `src/{models,services,routes,util}/`, `public/`, `tests/{unit,contract,e2e}/`, and runtime `data/{snapshots,thumbnails,favicons}/` directories
- [ ] T003 [P] Add `.gitignore` at repo root ignoring `node_modules/` and `data/`
- [ ] T004 [P] Write `/work/.harness/app.json`: `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Implement SQLite connection and schema in `src/db.js`: tables per data-model.md — `bookmarks` (id PK; address required; normalized_url UNIQUE indexed; title; description nullable; favicon_path nullable; preview_image_path nullable; notes nullable; status enum `read`|`unread` default `unread`; archived boolean default 0; snapshot_path nullable; snapshot_type enum `webpage`|`pdf` nullable; snapshot_available boolean default 0; created_at, updated_at ISO datetimes), `tags` (id PK; name required, case-insensitive UNIQUE, trimmed), and join `bookmark_tags` (bookmark_id FK, tag_id FK, both ON DELETE CASCADE)
- [ ] T006 Implement `server.js`: create Express app, JSON body parsing, serve `public/` statically, mount `/api` routers, serve `data/{favicons,thumbnails}` as static assets, listen on `0.0.0.0:4000`
- [ ] T007 [P] Implement URL validation + normalization in `src/util/url.js`: reject non-http(s)/malformed addresses; produce `normalized_url` (lowercase scheme+host, strip default ports, drop trailing slash and fragment, preserve query) for duplicate detection
- [ ] T008 [P] Implement JSON error-handling middleware in `src/util/errors.js`: uniform `{ "error": "<message>" }` responses with correct status codes
- [ ] T009 Build the app shell: `public/index.html` (nav for All / Unread / Archive views, add-bookmark form, list container, detail/edit panel), `public/app.js` (view routing + API client skeleton, sets `data-harness-ready="true"` on the shell after the initial view + data load, including valid empty state), `public/styles.css`
- [ ] T010 [P] Implement Tag model in `src/models/tag.js`: case-insensitive upsert by trimmed name, associate/replace tags on a bookmark, list tags

**Checkpoint**: Server starts, DB ready, empty UI renders and reports ready — story work can begin

---

## Phase 3: User Story 1 - Save a bookmark with automatic page details (Priority: P1) 🎯 MVP

**Goal**: Save a bookmark by address; auto-fetch title/description/favicon/preview image; allow editing title/description; graceful fallback when details unavailable.

**Independent Test**: Add a valid address with no title → bookmark appears with auto-filled title/description/favicon/thumbnail; edit title/description and confirm persistence; invalid address is rejected with a message and nothing saved.

### Tests for User Story 1

- [ ] T011 [P] [US1] Unit test URL validation/normalization in `tests/unit/url.test.js` (valid/invalid addresses; normalization equivalences)
- [ ] T012 [P] [US1] Unit test metadata parsing in `tests/unit/metadata.test.js` (title, meta description, og:image, favicon link; fallbacks when absent)
- [ ] T013 [P] [US1] Contract test `POST /api/bookmarks` and `PATCH /api/bookmarks/:id` in `tests/contract/bookmarks-create.test.js` (201 shape; 400 on invalid address; edit persists title/description)

### Implementation for User Story 1

- [ ] T014 [P] [US1] Implement metadata extraction in `src/services/metadata.js`: parse title, `<meta description>`, OpenGraph/Twitter tags (`og:title`/`og:description`/`og:image`), favicon `<link rel="icon">` (fallback `/favicon.ico`), using node-html-parser
- [ ] T015 [US1] Implement capture service detail path in `src/services/capture.js`: load address in shared Chromium (Playwright, `executablePath` from `/opt/playwright-browsers`), obtain rendered HTML for metadata.js, download favicon → `data/favicons/`, download `og:image` or capture a full-page screenshot → `data/thumbnails/`; on failure return empty details without throwing (FR-005)
- [ ] T016 [US1] Implement Bookmark model create/read/update in `src/models/bookmark.js`: insert with normalized_url, derive title from address when none (FR-005), read by id, update title/description/notes/tags/status; join tags via tag.js
- [ ] T017 [US1] Implement `src/routes/bookmarks.js` — `POST /api/bookmarks` (validate address→400; fetch details via capture; create; return 201 Bookmark), `GET /api/bookmarks/:id`, `PATCH /api/bookmarks/:id` (edit title/description/notes/tags/status) per contracts/api.md
- [ ] T018 [US1] Wire UI add-form + list + edit in `public/app.js`/`index.html`: submit address, render bookmark cards (title, address, favicon, thumbnail, tags), open detail/edit to change title/description, show inline validation error on 400

**Checkpoint**: US1 fully functional — save with auto details, edit, validation. MVP demoable.

---

## Phase 4: User Story 2 - Preserve a snapshot of the saved page (Priority: P1)

**Goal**: Capture and store a faithful static snapshot at save time (MHTML for web pages, original bytes for PDFs); reopen later; mark unavailable on failure.

**Independent Test**: Save a web page → reopen snapshot shows captured static content; save a PDF address → snapshot served/reopened as PDF; a failed capture still saves and is marked "no snapshot available".

### Tests for User Story 2

- [ ] T019 [P] [US2] Contract test `GET /api/bookmarks/:id/snapshot` in `tests/contract/snapshot.test.js` (correct content type for webpage vs pdf; 404 when unavailable)

### Implementation for User Story 2

- [ ] T020 [US2] Extend `src/services/capture.js`: detect content type (HTTP `Content-Type`, URL extension hint); PDF → download original bytes to `data/snapshots/<id>.pdf` (snapshot_type `pdf`); web page → capture single-file MHTML via Chromium CDP `Page.captureSnapshot` to `data/snapshots/<id>.mhtml` (snapshot_type `webpage`); set snapshot_available; on failure leave snapshot_available=0 (FR-006/FR-007/FR-008)
- [ ] T021 [US2] Persist snapshot fields in `src/models/bookmark.js` and integrate snapshot capture into the `POST /api/bookmarks` flow in `src/routes/bookmarks.js`
- [ ] T022 [US2] Implement `src/routes/snapshots.js` — `GET /api/bookmarks/:id/snapshot`: serve with `multipart/related` for MHTML and `application/pdf` for PDF; 404 when unavailable
- [ ] T023 [US2] Add "View snapshot" affordance and "no snapshot available" indicator to bookmark cards/detail in `public/app.js`

**Checkpoint**: US1 + US2 work — bookmarks saved with reopenable snapshots; PDFs preserved.

---

## Phase 5: User Story 3 - Browse, sort, and find (Priority: P2)

**Goal**: Keyword search, tag filter, and sort by date added / title (asc/desc); empty-result state.

**Independent Test**: With many bookmarks, search matches title/address/description/notes/tags; tag filter narrows; sort toggles reorder; no-match shows empty-result message.

### Tests for User Story 3

- [ ] T024 [P] [US3] Contract test `GET /api/bookmarks` query params in `tests/contract/bookmarks-list.test.js` (`q`, `tag`, `sort`, `order`, empty results)

### Implementation for User Story 3

- [ ] T025 [US3] Implement query in `src/models/bookmark.js`: list with keyword search across title/address/description/notes/tag names, tag filter, sort `created`|`title` × order `asc`|`desc` (FR-011/FR-012/FR-013)
- [ ] T026 [US3] Implement `GET /api/bookmarks` in `src/routes/bookmarks.js` honoring `view`, `q`, `tag`, `sort`, `order` per contracts/api.md
- [ ] T027 [US3] Add search box, tag filter control, sort controls, and empty-result state to `public/app.js`/`index.html`; add "open address in new tab" action (FR-019)

**Checkpoint**: US1–US3 independently functional.

---

## Phase 6: User Story 4 - Read-later status and unread view (Priority: P2)

**Goal**: Toggle read/unread; dedicated unread view.

**Independent Test**: Mark unread → appears in unread view; mark read → leaves unread view, remains in full list.

### Implementation for User Story 4

- [ ] T028 [US4] Support `status` filter for `view=unread` in the list query in `src/models/bookmark.js` and `GET /api/bookmarks` (`view=unread` → active + unread)
- [ ] T029 [US4] Add read/unread toggle action (via `PATCH status`) and the Unread view with its empty state in `public/app.js`/`index.html`

**Checkpoint**: US1–US4 functional.

---

## Phase 7: User Story 5 - Notes on a bookmark (Priority: P2)

**Goal**: Add/edit free-form notes; searchable.

**Independent Test**: Add a note → persists and shown; search note text finds the bookmark.

### Implementation for User Story 5

- [ ] T030 [US5] Ensure notes persist via `PATCH /api/bookmarks/:id` and are included in keyword search (`src/models/bookmark.js`, `src/routes/bookmarks.js`) — confirm search coverage from T025
- [ ] T031 [US5] Add notes field to the detail/edit panel in `public/app.js`/`index.html`

**Checkpoint**: US1–US5 functional.

---

## Phase 8: User Story 6 - Reversible archiving, distinct from deletion (Priority: P2)

**Goal**: Archive/restore (reversible) with archive view; separate permanent delete with confirmation and asset cleanup.

**Independent Test**: Archive → leaves main list, appears in archive; restore → returns; delete (confirmed) → permanently gone from all views.

### Tests for User Story 6

- [ ] T032 [P] [US6] Contract test archive/restore/delete in `tests/contract/archive-delete.test.js` (archive/restore flip `archived`; delete returns 204 and record gone)

### Implementation for User Story 6

- [ ] T033 [US6] Implement archive/restore/delete in `src/models/bookmark.js` (set/clear archived; delete record) and on delete remove associated snapshot/thumbnail/favicon files (FR-017)
- [ ] T034 [US6] Implement `POST /api/bookmarks/:id/archive`, `POST /api/bookmarks/:id/restore`, `DELETE /api/bookmarks/:id` in `src/routes/bookmarks.js`; ensure `view=archive` lists archived only
- [ ] T035 [US6] Add archive/restore buttons, the Archive view with empty state, and a delete confirmation dialog in `public/app.js`/`index.html`

**Checkpoint**: US1–US6 functional.

---

## Phase 9: User Story 7 - Duplicate address opens the existing bookmark (Priority: P2)

**Goal**: Re-submitting an existing address opens it for editing instead of creating a copy (including archived).

**Independent Test**: Save an address, submit it again → existing bookmark opens for editing; no duplicate; works when existing is archived.

### Tests for User Story 7

- [ ] T036 [P] [US7] Contract test duplicate create in `tests/contract/duplicate.test.js` (`POST` same address → 200 `{duplicate:true, bookmark}`, no new row; archived case)

### Implementation for User Story 7

- [ ] T037 [US7] Add normalized-url lookup across active + archived in `src/models/bookmark.js`; in `POST /api/bookmarks` return `200 {duplicate:true, bookmark}` on match instead of inserting (FR-018)
- [ ] T038 [US7] Handle the duplicate response in `public/app.js`: open the existing bookmark in the detail/edit panel with a "already saved" notice

**Checkpoint**: US1–US7 functional.

---

## Phase 10: User Story 8 - Import and export bookmarks (Priority: P3)

**Goal**: Import/export the standard Netscape bookmark HTML; folders → tags; no duplicate addresses; report counts.

**Independent Test**: Import a standard bookmark file → entries added, folders→tags, existing not duplicated, counts reported; export → standard file that re-imports intact with no duplicates.

### Tests for User Story 8

- [ ] T039 [P] [US8] Unit test Netscape parse/generate + folder→tag mapping in `tests/unit/porting.test.js`
- [ ] T040 [P] [US8] Contract test `POST /api/import` and `GET /api/export` in `tests/contract/porting.test.js` (imported/skippedDuplicates/invalid counts; export re-imports without duplication)

### Implementation for User Story 8

- [ ] T041 [US8] Implement `src/services/porting.js`: parse Netscape bookmark HTML (`<DL><DT><A HREF>` with nested `<H3>` folders → tags) and generate the same format from the collection
- [ ] T042 [US8] Implement `src/routes/porting.js`: `POST /api/import` (multipart upload; add valid entries reusing duplicate lookup; skip+count invalid) and `GET /api/export` (attachment); mount in `server.js`
- [ ] T043 [US8] Add Import (file upload + result summary) and Export (download) controls to `public/app.js`/`index.html`

**Checkpoint**: All user stories functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T044 [P] [US2/US8] Playwright e2e in `tests/e2e/`: save→auto-details→snapshot reopen; duplicate→edit; archive/restore/delete; import/export round-trip (pin `@playwright/test` 1.61.0, reuse shared Chromium)
- [ ] T045 Run `quickstart.md` validation scenarios end-to-end against the running server, including durability (restart → data/snapshots persist, SC-005)
- [ ] T046 [P] Confirm empty states for empty collection, unread, archive, and no-match search (FR-023); truncate long titles/addresses/notes without breaking layout
- [ ] T047 Verify runtime readiness: server binds `0.0.0.0:4000`, `data-harness-ready="true"` set only after initial load, `.harness/app.json` correct; check `data/../runtime/server.log` on failure

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–10)**: depend on Foundational; ordered by priority (US1, US2 = P1; US3–US7 = P2; US8 = P3)
- **Polish (Phase 11)**: depends on the targeted stories being complete

### Story dependencies / notes

- **US1 (P1)**: foundation only — the MVP.
- **US2 (P1)**: extends the capture service and create flow from US1.
- **US3 (P2)**: adds list querying; US4/US5 reuse the US3 query (search/status/notes coverage).
- **US6, US7**: build on the bookmark model + routes; independently testable.
- **US8 (P3)**: reuses the duplicate lookup (T037) for no-duplicate import.

### Parallel opportunities

- Setup: T003, T004 in parallel.
- Foundational: T007, T008, T010 in parallel after T005/T006.
- US1 tests T011–T013 in parallel; metadata service T014 parallel to model work.
- Contract tests across stories (T019, T024, T032, T036, T040) are independent files and can be written in parallel once their endpoints exist.

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **validate** → demo.

### Incremental delivery

Add US2 (snapshots) → US3 (find) → US4/US5 (unread/notes) → US6 (archive/delete) → US7 (dedupe) → US8 (import/export), validating each independently.

---

## Notes

- [P] = different files, no incomplete dependencies.
- Save is synchronous through detail-fetch + snapshot so a created bookmark is fully populated when listed (SC-001/SC-002/SC-004).
- Playwright pinned to 1.61.0; reuse `/opt/playwright-browsers` — no second browser download.
- Commit after each task or logical group.
