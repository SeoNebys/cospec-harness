# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user web application to save, browse, search, tag, edit, open, and delete
bookmarks, with local persistence that survives restarts. The approach is a small
Node.js HTTP service exposing a JSON REST API over a local SQLite database, paired
with a lightweight browser front end (server-rendered shell + vanilla JavaScript)
that provides the save form, searchable/filterable list, and edit/delete flows.
The stack is chosen to be self-contained, dependency-light, and to satisfy the
persistence and responsiveness success criteria without external services.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**: Express (HTTP + routing), better-sqlite3 (embedded
storage). Front end: vanilla HTML/CSS/JavaScript served as static assets — no SPA
framework.

**Storage**: SQLite database file on the local filesystem (`data/bookmarks.db`),
created and migrated on first run.

**Testing**: Node.js built-in test runner (`node:test`) for unit/API tests;
Playwright 1.61.0 (pinned) for end-to-end browser checks.

**Target Platform**: Linux container; reviewed in Chromium via the runtime harness
on port 4000.

**Project Type**: Web application (single deployable: API + served static front
end).

**Performance Goals**: Bookmark list and search return within 1 second with at
least 1,000 saved bookmarks (SC-005); typical operations feel instant.

**Constraints**: Local-only storage (no external network dependency for core
flows); server listens on `0.0.0.0:4000`; single-user, no authentication in v1.

**Scale/Scope**: One user; on the order of thousands of bookmarks; ~4 primary
screens/flows (save, list/search, edit, delete confirmation).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unpopulated
template with placeholder principles only — no ratified, enforceable gates are
defined. There are therefore no constitution constraints to violate.

Applied defaults in the spirit of the template: keep the design simple
(single deployable, no unnecessary layers), prefer a testable API boundary, and
avoid speculative features (YAGNI) beyond the approved v1 scope.

- Initial check: **PASS** (no defined gates; design kept minimal).
- Post-design re-check: **PASS** (see end of Phase 1 — no new complexity
  introduced; Complexity Tracking left empty).

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST API contract)
│   └── api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── server.js            # App entry: creates HTTP server, listens on 0.0.0.0:4000
├── app.js               # Express app wiring (routes, static assets, error handling)
├── db/
│   ├── index.js         # SQLite connection + migration/bootstrap
│   └── schema.sql       # Table definitions (bookmarks, tags, bookmark_tags)
├── models/
│   └── bookmark.js      # Data access: create/list/search/get/update/delete
├── services/
│   ├── bookmarks.js     # Business rules: validation, title derivation, duplicate warn
│   └── url.js           # URL normalization/validation, title fetch/fallback
└── routes/
    └── bookmarks.js     # REST endpoints mapping to the service layer

public/
├── index.html           # App shell; sets data-harness-ready when loaded
├── app.js               # Front-end logic: fetch API, render list, forms, filters
└── styles.css           # Styling

tests/
├── unit/                # url normalization, validation, title derivation
├── api/                 # REST endpoint tests against an in-process app + temp DB
└── e2e/                 # Playwright flows: save, search, tag-filter, edit, delete

data/                    # SQLite database file (gitignored, created at runtime)
package.json             # scripts: start, test; deps pinned (playwright 1.61.0)
```

**Structure Decision**: Single web-application project (not split frontend/backend
repos) because it is one small deployable serving both the JSON API and the static
front end from the same Node process on port 4000. A thin layered structure
(routes → services → models → db) keeps validation and business rules testable
independently of HTTP and of the browser.

## Complexity Tracking

> No constitution violations to justify. Section intentionally left empty.
