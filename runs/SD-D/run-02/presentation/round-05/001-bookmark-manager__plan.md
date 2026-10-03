# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, same-device web app to save and manage bookmarks. Saving a URL
auto-captures its title, description, favicon, and preview image; each bookmark
carries a Markdown note, shared-identity tags, a read/unread state, and an
archive flag, and can be permanently deleted. Users browse a normal list and
separate unread/archived views, search with a boolean/`#tag`/phrase language,
sort, act in bulk, save reusable searches, capture self-contained-HTML (or PDF)
snapshots, push pages to the Internet Archive, import/export Netscape bookmark
files, and tune display preferences.

**Technical approach** (from [research.md](./research.md)): one **Node.js 24 +
Express** process serves a built **React (Vite)** UI and a JSON API on
`0.0.0.0:4000`. Structured data lives in **SQLite (`better-sqlite3`)**; snapshot
files and cached favicon/preview images live on the local filesystem under
`data/`. Server-side page fetching (`cheerio`) provides metadata; **Playwright
1.61.0 / Chromium** (already in the image) renders self-contained HTML snapshots
and drives E2E tests; the Internet Archive Save Page Now endpoint provides
archival. A hand-written parser implements the search grammar.

## Technical Context

**Language/Version**: JavaScript on Node.js 24 (ES modules); React 18 for the UI.

**Primary Dependencies**: Express (server), better-sqlite3 (storage), cheerio
(HTML/metadata + Netscape parsing), marked + DOMPurify (Markdown notes), React +
Vite (UI), Playwright 1.61.0 (snapshots + E2E). No second browser download —
uses `/opt/playwright-browsers`.

**Storage**: SQLite database file plus a filesystem store for snapshots and
cached favicon/preview images, all under `data/` (created at runtime).

**Testing**: `node:test` (built-in) for backend unit tests (search parser, URL
normalizer, Netscape import/export); `@playwright/test` pinned to 1.61.0 for
end-to-end journeys.

**Target Platform**: Local web app; modern desktop browser UI served by a local
Node process (Linux runtime image). Reviewed at `http://maker:4000`.

**Project Type**: Web application (browser frontend + local backend), single
Node process.

**Performance Goals**: List/search visibly updates in <1s with ≥500 bookmarks
(SC-008); a bulk action applies to ≥100 bookmarks in one operation (SC-006);
first bookmark saved within 30s of first open (SC-001).

**Constraints**: Single user, no accounts/auth; same-device persistence only, no
sync; http/https URLs only; metadata/snapshot/archive fetching is best-effort and
must never block or corrupt the collection; snapshots reopen offline; graceful
handling when local storage runs low.

**Scale/Scope**: Hundreds–low thousands of bookmarks for one user; 9 user
stories (P1–P3), 40 functional requirements (FR-001–FR-039 incl. FR-008a).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is an **unratified
template** (placeholder principles only). There are therefore no ratified,
project-specific gates to enforce. In their absence this plan is held to the
method's baseline principles and the repository's `CLAUDE.md`:

- **Spec-first (SDD)**: PASS — spec was drafted, revised across gates, and
  explicitly approved before this plan; no code has been written.
- **Simplicity / YAGNI**: PASS — one process, one embedded database, one browser
  engine reused for two jobs; no service mesh, no auth system, no second app.
- **Testability**: PASS — the highest-risk logic (search grammar, URL
  normalization, Netscape round-trip) is isolated in pure modules with unit
  tests; journeys covered by Playwright.
- **Runtime delivery (CLAUDE.md)**: PASS — plan targets a single foreground
  `npm start` server on `0.0.0.0:4000`, with `data-harness-ready` and
  `/work/.harness/app.json` handled in the implement phase.

**Result**: PASS (no violations; Complexity Tracking left empty). Re-checked
after Phase 1 design below — still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R1–R12)
├── data-model.md        # Phase 1 — entities, schema, transitions
├── quickstart.md        # Phase 1 — build/run/validate guide
├── contracts/           # Phase 1 — API, search grammar, Netscape format
│   ├── api.md
│   ├── search-grammar.md
│   └── netscape-format.md
├── checklists/
│   └── requirements.md  # spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
/work
├── package.json              # root scripts: start, build, dev, test, test:e2e
├── server/
│   ├── src/
│   │   ├── index.js          # Express entry; serves web/dist + /api; listens 0.0.0.0:4000
│   │   ├── db/
│   │   │   ├── connection.js  # better-sqlite3 handle under data/
│   │   │   └── schema.sql     # tables + indexes + migrations
│   │   ├── models/            # data access: bookmarks, tags, savedSearches, snapshots, preferences
│   │   ├── services/
│   │   │   ├── metadata.js    # fetch page → title/description/favicon/preview (cheerio)
│   │   │   ├── snapshot.js    # Playwright self-contained HTML; PDF passthrough
│   │   │   ├── archiveOrg.js  # Save Page Now submit + record
│   │   │   ├── netscape.js    # import/export Netscape bookmark file
│   │   │   └── url.js         # normalization + validation + duplicate key
│   │   ├── search/
│   │   │   ├── tokenizer.js
│   │   │   ├── parser.js      # → expression tree; reports invalid expressions
│   │   │   └── evaluate.js    # expression tree → matching bookmarks
│   │   └── routes/            # bookmarks, tags, savedSearches, preferences, importExport, snapshots
│   └── tests/                # node:test unit tests (search, url, netscape)
├── web/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx, App.jsx
│       ├── api/client.js      # typed fetch wrappers to /api
│       ├── views/             # NormalView, UnreadView, ArchivedView
│       ├── components/        # BookmarkCard, BookmarkList, SaveDialog, EditDialog,
│       │                      # SearchBar, TagChips/TagFilter, TagSuggest, BulkActionBar,
│       │                      # SavedSearches, PreferencesPanel, ImportExport, SnapshotViewer,
│       │                      # NoteMarkdown, EmptyState
│       └── lib/               # markdown render (marked+DOMPurify), formatting, hooks
├── tests/e2e/                # Playwright 1.61.0 specs (one per user story)
└── data/                     # runtime: sqlite db, snapshots/, cache/ (gitignored)
```

**Structure Decision**: Web-application layout with a `server/` backend and a
`web/` frontend built by Vite. A **single Node process** (`server/src/index.js`)
serves the built `web/dist` static assets and the `/api` JSON routes on port
4000, satisfying the one-foreground-command delivery model. `data/` is created at
runtime and holds all persistent state on the same device.

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.

## Phase 1 re-evaluation

After designing the data model and contracts (below), the Constitution Check was
re-run: the design stays within one process, one database, one browser engine,
and pure testable modules for risky logic. **Still PASS.**

## Design artifacts produced

- [research.md](./research.md) — decisions R1–R12.
- [data-model.md](./data-model.md) — entities, SQLite schema, relationships,
  state transitions, validation rules mapped to FRs.
- [contracts/api.md](./contracts/api.md) — HTTP+JSON API for every user story.
- [contracts/search-grammar.md](./contracts/search-grammar.md) — query language
  grammar and evaluation semantics (FR-018–024).
- [contracts/netscape-format.md](./contracts/netscape-format.md) — import/export
  file contract (FR-035–037).
- [quickstart.md](./quickstart.md) — how to build, run on port 4000, and validate
  each story.

## Next gate

`/speckit-tasks` will turn this plan into an actionable, dependency-ordered
`tasks.md`. Per project convention, implementation (`/speckit-implement`) begins
only after the plan (and tasks) are approved.
