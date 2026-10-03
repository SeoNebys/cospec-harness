# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, browser-based bookmark manager. The user saves web addresses; the
system automatically fetches page metadata (title, description, favicon, preview
image) which the user may adjust before the first save. Bookmarks carry tags,
Markdown notes, read/unread and archived states. The app provides advanced
case-insensitive search (substring across title/description/note/address, `#tag`
terms combined with AND, quoted exact phrases, `AND`/`OR`/`NOT`/parentheses with
quoted operator words treated literally), sorting, tag filtering with
suggestions, bulk actions over the complete current view, reversible archiving
distinct from permanent deletion, saved searches, page preservation (single-file
local HTML, original PDF for PDF links, optional Internet Archive snapshot),
browser-HTML import/export, and display preferences.

**Technical approach**: A Node.js web application with a REST/JSON backend
(Express + better-sqlite3, single local SQLite database file) and a build-free
single-page frontend (ES-module vanilla JS). Metadata fetch and single-file page
preservation reuse the image's installed Playwright/Chromium. Search is a small
custom boolean parser compiled to parameterised SQL `LIKE` (COLLATE NOCASE)
clauses. Markdown is rendered with markdown-it and sanitised. The server listens
on `0.0.0.0:4000` for the review environment.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP/REST), better-sqlite3 (embedded storage),
Playwright 1.61.0 (metadata fetch + single-file page capture, reuses installed
Chromium), markdown-it (Markdown render), sanitize-html (note/preservation
sanitising), node-html-parser (bookmark-HTML import parsing). Frontend: vanilla
ES modules, no build step.

**Storage**: A single SQLite database file at `data/bookmarks.db`; preserved
copies (self-contained `.html`) and original PDFs stored as files under
`data/preserved/` referenced by path from the database.

**Testing**: Node.js built-in test runner (`node --test`) for unit/integration of
backend modules (search parser, import/export, metadata, model); Playwright Test
1.61.0 for end-to-end UI flows against the running server.

**Target Platform**: Linux container; modern desktop browser (Chromium) for the
client. Server bound to `0.0.0.0:4000`.

**Project Type**: Web application (single project: backend API + static frontend
served by the same server).

**Performance Goals**: Search/filter results within 1s for ≥1,000 bookmarks;
bulk action over ≥200 matches in a single operation; save (excluding external
fetch latency) responsive under normal use.

**Constraints**: Single-user, no authentication. Automatic metadata capture and
Internet Archive preservation depend on external reachability and must fail soft
(bookmark still saved / unaffected). Preserved web page must be a single
self-contained HTML file openable offline. Notes stored as Markdown source
verbatim. HTTP session cookies must work in the review environment (no auth is
required, so this is minimal). Preserve `package-lock.json`; pin Playwright to
1.61.0; do not download a second browser revision.

**Scale/Scope**: Personal collection, target ≥1,000 bookmarks (design headroom to
several thousand). 13 user stories, 41 functional requirements. ~6 primary views
(all/list, unread, archive, edit, saved searches, preferences).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is the unmodified
template with no ratified principles (all placeholders). There are therefore no
binding constitutional gates to evaluate. Applied default engineering guardrails
instead, all satisfied by this plan:

- **Simplicity / YAGNI**: single project, single embedded database, no build
  step on the frontend, no auth layer (single-user). ✅
- **Fail-soft external dependencies**: metadata fetch, preservation, and
  Internet Archive are non-fatal and isolated. ✅
- **Testability**: pure modules (search parser, import/export) unit-tested;
  end-to-end flows covered by Playwright. ✅
- **Lockfile / toolchain discipline**: pin Playwright 1.61.0, reuse shared
  Chromium, keep `package-lock.json`. ✅

No violations; Complexity Tracking left empty. (Re-checked after Phase 1 design:
still no violations — the design adds no extra projects or patterns beyond those
above.)

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── rest-api.md      # HTTP endpoint contracts
│   └── search-grammar.md# Search query language contract
├── spec.md              # Approved specification
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
src/
├── server.js                 # Express app bootstrap, static + API mount, 0.0.0.0:4000
├── db/
│   ├── index.js              # better-sqlite3 connection, migrations runner
│   └── migrations/           # SQL schema (bookmarks, tags, bookmark_tags, saved_searches, preferences)
├── models/
│   ├── bookmark.js           # CRUD, state transitions (read/unread, archive/restore)
│   ├── tag.js                # tag upsert, suggestions, usage set
│   ├── savedSearch.js
│   └── preferences.js
├── services/
│   ├── metadata.js           # fetch title/description/favicon/preview (Playwright/Chromium)
│   ├── preservation.js       # single-file HTML capture; PDF passthrough; Internet Archive submit
│   ├── search/
│   │   ├── tokenizer.js       # quotes, #tags, operators, parentheses
│   │   ├── parser.js          # boolean AST (AND/OR/NOT/grouping; implicit AND)
│   │   └── compile.js         # AST -> parameterised SQL WHERE (LIKE COLLATE NOCASE)
│   ├── importer.js           # Netscape bookmark HTML -> bookmarks (titles/tags/dates, no dupes)
│   └── exporter.js           # bookmarks -> Netscape bookmark HTML
├── api/
│   ├── bookmarks.js          # /api/bookmarks routes incl. bulk actions & select-all-matching
│   ├── tags.js               # /api/tags, suggestions
│   ├── savedSearches.js
│   ├── preferences.js
│   ├── importExport.js       # /api/import, /api/export
│   └── preservation.js       # /api/bookmarks/:id/preserve, /archive-org, serve preserved file
└── lib/
    ├── url.js                # URL validation & normalisation (duplicate detection key)
    └── markdown.js           # markdown-it + sanitize-html render

public/                       # build-free SPA served statically
├── index.html               # app shell; sets data-harness-ready when loaded
├── css/styles.css           # includes text-size preference hooks
└── js/
    ├── app.js               # bootstrap, routing between views
    ├── api.js               # fetch wrappers
    ├── views/               # list, unread, archive, edit, savedSearches, preferences
    └── components/          # bookmark row, tag input (suggestions), search bar, bulk bar

tests/
├── unit/                    # search parser, url, markdown, importer/exporter
├── integration/             # api routes + db (node --test)
└── e2e/                     # Playwright 1.61.0 UI flows (per user story)

data/                        # runtime (gitignored): bookmarks.db, preserved/
```

**Structure Decision**: Single web-application project. The Express server serves
both the JSON API (`/api/*`) and the static SPA (`public/`) on one port (4000),
which is the simplest layout that satisfies the review-environment requirement
and keeps one lockfile/toolchain. Backend logic is split into pure, testable
modules (notably the search pipeline and import/export) with thin HTTP handlers.

## Complexity Tracking

> No constitution violations; no entries required.
