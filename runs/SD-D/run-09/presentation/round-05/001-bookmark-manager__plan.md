# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

A single-user web application to save, find, organize, and preserve bookmarks.
Saving a URL first **collects title, description, favicon, and preview image for
the person to review and edit before committing**; the committed bookmark then
captures a self-contained local snapshot in the background (single HTML for web
pages, PDF for PDFs) with optional Internet Archive preservation, and supports
read-later/archive workflows, advanced search, bulk actions, saved filters,
Netscape-format import/export, and display preferences.

**Technical approach**: One Node.js 24 process (Express) serves a JSON API and a
Vite-built React SPA on `0.0.0.0:4000`. Data persists in SQLite
(`better-sqlite3`); snapshot files live on disk.

**Save flow (revised per client review)**: a two-step create — (1) a **preview**
step collects metadata synchronously (Cheerio over a bounded ~8s fetch) and
returns it for review/edit without persisting; if the page can't be read promptly
it returns fallback details so the person can continue immediately (FR-007); (2) a
**commit** step persists the reviewed title/description. The whole save stays
within the 15s target (SC-001). The **only** background work is snapshot capture
(Chromium/Playwright + SingleFile), and it **never overwrites the person's title
or description** — background writes are limited to snapshot fields (and
favicon/preview only if still empty).

Search uses a hand-written boolean parser evaluated in the app layer for exact
grammar control. See [research.md](./research.md) for decisions and rationale.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript/ESM), targeting modern browsers for the SPA.

**Primary Dependencies**: Express 4 (API + static serving); better-sqlite3 (storage);
Cheerio (pre-commit metadata collection + Netscape parsing); Playwright 1.61.0 +
shared Chromium and `single-file-cli` (background snapshots); React 18 + Vite
(frontend); `marked` + DOMPurify (sanitized Markdown notes); Multer (import upload).

**Storage**: SQLite database file (`data/bookmarks.db`) + snapshot files under
`data/snapshots/`.

**Testing**: Vitest (unit + API via Supertest); Playwright 1.61.0 (E2E, Chromium).

**Target Platform**: Linux container; served on `0.0.0.0:4000`, reached at
`http://maker:4000` (client) / `http://127.0.0.1:4000` (capture).

**Project Type**: Web application (single deployable Node process serving API +
static frontend).

**Performance Goals**: Save-to-listed under 15s (SC-001); search/sort under 1s at
1,000 bookmarks (SC-003); bulk action over 100+ items in one operation (SC-008).

**Constraints**: Single-user, no auth; offline-tolerant (metadata/snapshot/web-
archive degrade gracefully); Playwright pinned to 1.61.0 to match the shared
browser revision (no second browser download); `npm start` only starts the
prepared app (install/build done beforehand); lockfile preserved.

**Scale/Scope**: One person's collection on the order of thousands of bookmarks
with snapshots; 10 user stories; ~6 primary UI views.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified
template containing only placeholders — no concrete principles or gates are
defined. There are therefore **no constitution constraints to violate**.

- **Initial check (pre-Phase 0)**: PASS (no gates defined).
- **Post-design re-check (post-Phase 1)**: PASS. Design adds no unjustified
  complexity: one process, one datastore, no extra services. Reuse of the image's
  Chromium and a pinned Playwright avoids environment drift.

Complexity Tracking is therefore empty (no violations to justify).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── spec.md              # Approved specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── openapi.yaml     # REST API contract
│   └── search-grammar.md# Search parsing/evaluation contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── index.js             # Express app bootstrap; serves API + static; listens 0.0.0.0:4000
│   ├── db/
│   │   ├── connection.js     # better-sqlite3 open + pragmas
│   │   └── migrations.js     # schema creation (bookmarks, tags, bookmark_tags, filters, prefs)
│   ├── routes/
│   │   ├── bookmarks.js       # preview (pre-commit details), CRUD, list, bulk, snapshot serve, web-archive
│   │   ├── tags.js            # list + suggestions
│   │   ├── filters.js         # saved filters CRUD
│   │   ├── importExport.js    # Netscape import/export
│   │   └── preferences.js     # display preferences
│   ├── services/
│   │   ├── bookmarks.js       # create/edit/dedup logic, view queries, sort, pagination
│   │   ├── urlNormalize.js    # normalization + validation (Decision 9)
│   │   ├── search/
│   │   │   ├── parser.js      # tokenizer + boolean AST (search-grammar.md)
│   │   │   └── evaluate.js    # AST evaluation over candidates
│   │   ├── metadata.js        # pre-commit fetch+parse title/description/favicon/preview (bounded timeout, fallback)
│   │   ├── snapshot.js        # BACKGROUND SingleFile HTML capture / PDF download; writes snapshot fields only (never title/description)
│   │   ├── webArchive.js      # Internet Archive Save Page Now
│   │   ├── netscape.js        # import parse + export serialize (folders<->tags, dates)
│   │   └── jobQueue.js        # in-process background queue (snapshot capture only)
│   └── lib/
│       └── ids.js             # id generation
├── web/                       # React + Vite frontend
│   ├── main.jsx               # app entry; sets data-harness-ready after initial load
│   ├── routes/                # All / Unread / Archived / Edit / Filters / Preferences views
│   ├── components/            # list rows (favicon+desc+tags), add form, tag input, markdown view, bulk bar
│   └── api/                   # fetch client for the API
└── shared/                    # constants/enums shared by server & web (sort keys, statuses)

tests/
├── unit/                      # search parser/evaluate, urlNormalize, netscape, metadata
├── api/                       # Supertest against routes (with stubbed network)
├── e2e/                       # Playwright flows (save→search→edit→archive, import/export)
└── fixtures/                  # netscape .html, sample page .html, sample .pdf

data/                          # runtime (gitignored): bookmarks.db, snapshots/
public/ or dist/               # Vite build output served by Express
```

**Structure Decision**: Single Node project (not split frontend/backend
services) — one deployable process satisfies the `npm start` / single-port review
contract with the least operational surface. Frontend source under `src/web`
builds to static assets served by the same Express app. Tricky pure logic (search
grammar, URL normalization, Netscape format) is isolated in `src/server/services`
for direct unit testing.

## Phase 0 — Research

Complete. See [research.md](./research.md): 12 decisions covering app shape,
framework, storage, search parsing, metadata, snapshots (single-file HTML / PDF),
Internet Archive, Netscape import/export, URL normalization, frontend, async
enrichment, and testing. No `NEEDS CLARIFICATION` remain.

## Phase 1 — Design & Contracts

Complete:

- [data-model.md](./data-model.md) — Bookmark, Tag, bookmark_tags, SavedFilter,
  Snapshot (on-disk), DisplayPreferences; validation, states, views.
- [contracts/openapi.yaml](./contracts/openapi.yaml) — full REST surface.
- [contracts/search-grammar.md](./contracts/search-grammar.md) — search parsing &
  evaluation contract with worked + error examples.
- [quickstart.md](./quickstart.md) — build/run/test steps and 10 validation
  scenarios mapped to the user stories and success criteria.

## Traceability (spec → design)

| Spec area | Where addressed |
|-----------|-----------------|
| FR-001..007 Saving & metadata (review before commit; fallback) | services/bookmarks, urlNormalize, metadata; POST /api/bookmarks/preview (review) then POST /api/bookmarks (commit); 200-existing for duplicates |
| FR-008..012 Editing & organization | PATCH /api/bookmarks/{id}; tags route; marked+DOMPurify notes |
| FR-013..020 Browse/search/sort | list endpoint; search/parser+evaluate; sort keys; list-row component |
| FR-021..025 Read-later/archive/bulk | read/archived fields; view queries; /api/bookmarks/bulk with match |
| FR-026..028 Import/export | services/netscape; /api/import, /api/export |
| FR-029..031 Snapshots & archival (background; no-overwrite of title/description) | services/snapshot (SingleFile/PDF) via jobQueue writing snapshot fields only, webArchive; snapshot serve endpoint |
| FR-032..033 Filters & preferences | /api/filters, /api/preferences |
| FR-034 Persistence | SQLite + on-disk snapshots |
| SC-001..010 | performance/async design; quickstart validation scenarios |

## Post-Design Constitution Re-check

PASS — no new complexity requiring justification (see Constitution Check above).

## Next step

Proceed to `/speckit-tasks` to generate the dependency-ordered task breakdown
from these artifacts. (Awaiting client approval of this plan per the SDD gate.)
