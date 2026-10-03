# Implementation Plan: Personal Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a responsive, single-user web application for saving and maintaining bookmarks. A React client will provide one collection-focused interface; an Express service will expose a same-origin JSON API and serve the production client; a file-backed SQLite database will preserve bookmark and tag data across sessions. Shared validation will keep browser feedback and server enforcement aligned. Automatic title retrieval remains outside this release, but the create boundary will allow it to be introduced later without changing stored bookmark fields.

## Technical Context

**Language/Version**: Node.js 24.15+ (validated on 24.21.0), TypeScript 6.x, modern browser JavaScript

**Primary Dependencies**: React 19.3, Vite 8.x, Express 5.2, Zod 4, `better-sqlite3` 13.x; plain CSS for presentation

**Storage**: File-backed SQLite database at `data/bookmarks.sqlite`, accessed through prepared statements and numbered migrations

**Testing**: Vitest 5 with V8 coverage, React Testing Library and `user-event`, Supertest for HTTP integration, Playwright 1.61.0 for browser acceptance tests, and `@axe-core/playwright` for automated accessibility checks

**Target Platform**: A Node-hosted responsive web application on Linux, serving current evergreen desktop and mobile browsers; production binds to `0.0.0.0:4000`

**Project Type**: Single-package web application with client, server, and shared TypeScript modules

**Performance Goals**: With 5,000 bookmarks, search/filter/sort changes display results within 1 second; ordinary create/update/archive/favorite/delete actions visibly settle within 1 second under local single-user load

**Constraints**: Single user and single installation; no authentication, external metadata retrieval, synchronization, or third-party service dependency; WCAG 2.2 Level AA target; prepared production build must start with `npm start`; URL and tag identity must be enforced at both service and database boundaries

**Scale/Scope**: Up to 5,000 bookmarks, up to 20 tags per bookmark, one primary collection screen, add/edit and delete-confirmation dialogs, five REST resources/actions, and one local database file

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The repository constitution is still an unratified placeholder and therefore defines no enforceable project-specific gates. The governing repository instructions require the gated Spec-Driven Development workflow. Those gates are satisfied at this stage: the specification is written and approved, this plan contains design only, and no implementation or task breakdown has begun.

Post-design re-check: the research, data model, interface contract, and quickstart remain within the approved specification. The plan does not add automatic title retrieval or any other deferred capability. No constitutional violation or complexity exception is present.

## Architecture

### Runtime flow

1. Express starts one application process, opens the SQLite database, applies pending numbered migrations, and listens on `0.0.0.0` using port `4000` by default.
2. In production, Express serves the built Vite client and the `/api` endpoints from the same origin.
3. The React client treats URL query parameters as the source of collection search, filter, and sort state. Mutations refresh the current query rather than resetting it.
4. The server validates every request, normalizes bookmark URLs and tags, performs transactional repository changes, and maps domain failures to the error contract.
5. SQLite constraints are the final guard for URL uniqueness, tag uniqueness, tag relationships, and valid boolean states.

### Key design decisions

- Use one npm workspace/package and one deployable process; the product has one screen, one user, and no need for independently deployed client and server services.
- Use a small repository layer with direct prepared SQL and explicit migrations instead of an ORM.
- Use `better-sqlite3` rather than the release-candidate `node:sqlite` API for a stable persistence dependency on the pinned Node runtime.
- Use shared Zod schemas for payload shape and field limits, while repeating critical constraints in SQLite so invalid data cannot bypass the service.
- Store the submitted URL and a separate normalized key. The normalization key uses the WHATWG URL parser, accepts only HTTP(S), lowercases scheme/host, removes default ports, and normalizes trailing-slash variants while preserving paths, query ordering, and fragments otherwise.
- Normalize tags by trimming, Unicode normalization, whitespace collapsing, and locale-independent lowercase comparison while retaining the first display spelling.
- Keep archived and favorite as independent states. Archived items are excluded from the default view but can remain favorites.
- Use semantic native controls and a modal dialog with deliberate focus placement/restoration; automated accessibility scans supplement keyboard, zoom/reflow, forced-colors, and screen-reader smoke checks.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md              # Created only after plan approval
```

### Source Code (repository root)

```text
data/
└── .gitkeep              # Runtime database is ignored

migrations/
└── 001_initial.sql

src/
├── client/
│   ├── components/
│   ├── hooks/
│   ├── styles/
│   ├── api.ts
│   ├── App.tsx
│   └── main.tsx
├── server/
│   ├── db/
│   ├── repositories/
│   ├── routes/
│   ├── app.ts
│   └── index.ts
└── shared/
    ├── bookmark-schema.ts
    ├── bookmark-types.ts
    ├── normalize-tag.ts
    └── normalize-url.ts

tests/
├── integration/
│   └── bookmarks-api.test.ts
└── e2e/
    ├── bookmarks.spec.ts
    ├── collection-view.spec.ts
    ├── persistence.spec.ts
    ├── accessibility.spec.ts
    └── performance.spec.ts
```

Unit and component tests live beside the modules they exercise as `*.test.ts` and `*.test.tsx`. Browser tests receive a temporary database through test-only process configuration; production never exposes a data-reset endpoint.

**Structure Decision**: A single-package full-stack layout keeps shared validation and normalization visible, produces one start command, and avoids infrastructure that the single-user scope does not need. Client, server, and shared boundaries are separate directories so later title metadata retrieval can be added server-side without coupling it to the interface or repository.

## Data and Persistence Strategy

- `bookmarks`, `tags`, and `bookmark_tags` are normalized relational tables described in [data-model.md](data-model.md).
- Bookmark and tag writes use transactions so the bookmark and all tag relationships succeed or fail together.
- A unique database constraint on `bookmarks.normalized_url` resolves race conditions after a friendly pre-check.
- Foreign keys and cascading junction cleanup are enabled and verified on startup.
- SQLite WAL mode is enabled for reliable read/write coexistence; the app owns one short-lived synchronous connection workload appropriate for the specified scale.
- Migrations run before listening. Each migration is recorded in a schema-migrations table and is applied once within a transaction.
- The runtime database, WAL, and shared-memory files are excluded from version control. Tests use isolated temporary databases.

## Interface Strategy

The interface contract is defined in [contracts/openapi.yaml](contracts/openapi.yaml). The client uses:

- `GET /api/bookmarks` for search, match-all tag filters, favorite/archive filters, and sorting.
- `POST /api/bookmarks` to create a bookmark.
- `PATCH /api/bookmarks/{id}` to edit details or change favorite/archive state.
- `DELETE /api/bookmarks/{id}` after client-side confirmation.
- `GET /api/tags` to populate available filters.

All failures use a stable error object with a machine-readable code, user-safe message, and optional field errors. Duplicate responses use HTTP 409 and include the existing bookmark identifier so the client can clear incompatible filters when necessary, reveal the existing item, and move focus to it.

## Validation and Error Handling

- Browser validation provides immediate, accessible feedback but the server is authoritative.
- Limits: title 1–200 characters, URL 1–2,048 characters before normalization, notes up to 5,000 characters, tags up to 20 per bookmark, and each tag 1–40 characters.
- Invalid protocols, malformed URLs, duplicate normalized URLs, missing records, invalid query values, and database failures have distinct response codes.
- Submitted form values remain in the dialog after validation or network errors.
- Mutation success and failure are announced through an accessible status region. Destructive confirmation defaults focus to the non-destructive action and restores focus predictably when closed.
- Outbound bookmarks open in a new browsing context with `noopener` and `noreferrer`, preserving collection view state.

## Verification Strategy

- **Static gates**: formatting, linting, and `tsc --noEmit` run independently of tests.
- **Unit tests**: URL/tag normalization, validation boundaries, literal case-insensitive search semantics, match-all tag filtering, deterministic sort tie-breaks, and repository mapping.
- **Component tests**: forms retain input on error, labeled controls expose field errors, filters update state, empty states differ, duplicate notices reveal the existing item, and delete confirmation supports confirm/cancel and focus restoration.
- **HTTP integration tests**: validate the OpenAPI behavior against a temporary database, including 409 duplicate handling, transactional tag replacement, cascade cleanup, query combinations, and error shapes.
- **Browser acceptance tests**: cover every acceptance scenario across P1–P3, persistence after a server restart, view-state preservation after mutations, new-tab opening, and a seeded 5,000-bookmark performance case.
- **Accessibility**: Playwright plus axe scans materially different states; manual keyboard-only, 200% zoom, 320 CSS-pixel reflow, forced-colors, and screen-reader smoke checks remain required because automation is incomplete.
- **Coverage policy**: business-critical shared and server modules target at least 90% statements/lines/functions and 85% branches; UI confidence is measured primarily through acceptance behavior rather than snapshot or line-coverage maximization.

The runnable validation sequence and expected outcomes are in [quickstart.md](quickstart.md).

## Runtime Delivery

- `npm run build` produces the Vite client and compiled server output.
- `npm start` runs the prepared production server in the foreground on `0.0.0.0:4000` by default.
- After successful implementation and verification, `/work/.harness/app.json` will declare the production application, port `4000`, path `/`, start command `["npm", "start"]`, and start directory `/work`.
- The initial ready application view will expose `data-harness-ready="true"` only after the collection request has resolved to either a loaded or valid empty state.

## Complexity Tracking

No constitution violations or exceptional complexity require justification.
