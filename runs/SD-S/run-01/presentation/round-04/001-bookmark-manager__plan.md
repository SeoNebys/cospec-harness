# Implementation Plan: Personal Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Status**: Approved

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a responsive single-user web application for saving and maintaining a durable bookmark collection. A React and TypeScript client will call a small Express JSON API, while SQLite will persist bookmarks and tags in a single local database. Shared runtime schemas will keep browser and server validation consistent. The server will deliver the production client and listen on `0.0.0.0:4000` so the finished application can be reviewed through the project harness.

The implementation deliberately excludes account management, sharing, imports, extensions, offline synchronization, and automatic page metadata. Users provide titles themselves in this version. The API and data model keep metadata retrieval possible as a later feature without adding unused fields or background processing now.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 LTS; modern browser JavaScript target

**Primary Dependencies**: React 19, Vite, Express 5, `better-sqlite3`, and Zod 4

**Storage**: SQLite database file using WAL mode, explicit SQL migrations, foreign keys, and transactions

**Testing**: Vitest for unit and service integration tests, React Testing Library for components, Supertest for HTTP contracts, and Playwright 1.61.0 with Chromium for end-to-end and responsive checks

**Target Platform**: Modern evergreen browsers; Linux-hosted Node.js process bound to `0.0.0.0:4000`

**Project Type**: Single-repository full-stack web application with one production server process

**Performance Goals**: Initial collection load and every search/filter/sort response complete within 1 second for 1,000 bookmarks under normal local review conditions

**Constraints**: Single user and single server process; no authentication; no external services required; durable data must survive process restarts; destructive deletion only from the archive after explicit UI confirmation; primary flows must work without horizontal scrolling at 375px and 1440px viewport widths

**Scale/Scope**: One personal collection, approximately 1,000 bookmarks, two primary collection views (active and archive), one create/edit form, and one confirmation dialog

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

The constitution file still contains only unratified template placeholders, so it imposes no project-specific technical gates. The repository-level SDD rules remain authoritative for workflow and have been followed:

- The specification was drafted, reviewed, and explicitly approved before planning.
- This plan defines design and validation only; it does not implement application code.
- The architecture stays within the approved single-user scope and does not introduce deferred capabilities.
- The final server and harness contract are planned for `0.0.0.0:4000` with an explicit readiness marker.
- No gate violations require a complexity exception.

**Post-design re-check**: Passed. The data model, HTTP contract, UI behavior contract, and validation guide remain aligned with the approved specification and introduce no constitution conflicts.

## Architecture

### Runtime Flow

1. The browser loads the built client from the Express server.
2. The client requests the active or archived collection through `/api/bookmarks` and renders the ready state only after that request resolves successfully.
3. Client form data is validated for immediate feedback and submitted to the API.
4. The API repeats validation at the trust boundary, normalizes addresses and tags, and delegates mutations to the bookmark service.
5. The service performs SQL reads and transactional writes through repositories, then returns a stable response or structured error.
6. The client updates or refreshes collection state, announces the result, and preserves the user's active view criteria.

### Key Design Decisions

- Use a single npm package and one production process to avoid unnecessary deployment and workspace complexity.
- Keep the client, server, and shared schemas in separate source folders so browser-only, server-only, and shared code boundaries remain explicit.
- Use direct parameterized SQL behind repository functions instead of an ORM; the domain has three small tables and benefits from visible, testable queries.
- Use ordinary indexed relational queries and case-insensitive matching rather than full-text search; the approved scale is 1,000 records and search semantics are substring matching across four fields.
- Represent archive state on the bookmark record. Permanent deletion is allowed only for archived records.
- Return structured machine-readable API error codes alongside user-safe messages so duplicate, validation, missing-record, and persistence failures can produce distinct UI behavior.
- Keep collection view state in the client. Search, tag, favorite, scope, and sort values are sent as query parameters but are not persisted as bookmark data.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── ui-behavior.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # Created only after this plan is approved
```

### Source Code (repository root)

```text
src/
├── client/
│   ├── components/
│   ├── features/bookmarks/
│   ├── hooks/
│   ├── styles/
│   ├── api.ts
│   ├── App.tsx
│   └── main.tsx
├── server/
│   ├── db/
│   │   ├── migrations/
│   │   ├── connection.ts
│   │   └── migrate.ts
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── app.ts
│   └── index.ts
└── shared/
    ├── bookmark-schemas.ts
    └── api-types.ts

tests/
├── unit/
├── integration/
├── component/
└── e2e/

data/
└── .gitkeep                 # Runtime database is ignored

dist/                        # Generated client and server output; ignored
package.json
package-lock.json
tsconfig.json
vite.config.ts
vitest.config.ts
playwright.config.ts
```

**Structure Decision**: Use one TypeScript package with explicit `client`, `server`, and `shared` boundaries. Vite builds the client, the TypeScript build emits the server, and Express serves both the JSON API and generated client assets from one foreground process. This is the smallest structure that supports durable server-side storage, browser UI, and end-to-end testing without creating independently deployed projects.

## Data and Validation Strategy

- The canonical model and state transitions are defined in [data-model.md](data-model.md).
- Zod schemas define request/query validation and shared limits. The server remains authoritative even when the client has already validated the same input.
- Addresses accept only absolute `http:` and `https:` URLs. Normalization trims input, lowercases scheme and host through URL parsing, removes default ports, and uses the serialized absolute URL for duplicate comparison while retaining a display-safe canonical address.
- Tags are trimmed, compared case-insensitively, de-duplicated within a submission, and retain the first supplied display casing.
- Create/update and tag-association changes run in transactions. Foreign-key enforcement is enabled for every connection.
- Search uses escaped parameterized substring matching over title, URL, notes, and associated tag names. Filter and sort values are allow-listed before query construction.

## Interface Strategy

- The HTTP request/response contract is defined in [contracts/openapi.yaml](contracts/openapi.yaml).
- User-visible states, confirmations, focus handling, and responsive expectations are defined in [contracts/ui-behavior.md](contracts/ui-behavior.md).
- The active and archived collections use the same list endpoint with different `scope` values.
- A duplicate create attempt returns `409 DUPLICATE_BOOKMARK`; the client shows the existing item and offers cancel or an explicit resubmission with `allowDuplicate: true`.
- A delete request for an active bookmark returns `409 BOOKMARK_NOT_ARCHIVED`, enforcing the lifecycle boundary in addition to the UI constraint.

## Testing Strategy

- **Unit**: URL normalization, tag normalization, schema boundaries, sort mapping, search escaping, and state transitions.
- **Integration**: migrations; repository queries; transactional tag replacement; duplicate handling; active/archive lifecycle; every HTTP success and structured error response against an isolated temporary database.
- **Component**: labeled create/edit fields, validation feedback, search/filter composition, empty states, duplicate warning, confirmation dialog, result announcements, and failed-mutation input preservation.
- **End to end**: each prioritized user story, persistence across server restart, combined query criteria, duplicate override, destructive confirmation/cancellation, 1,000-item performance check, and 375px/1440px layout checks.
- **Accessibility**: semantic role-based interaction tests, full keyboard completion of primary flows, focus movement/restoration for dialogs, visible focus, status announcements, and an automated WCAG A/AA scan supplemented by manual checks.
- **Delivery**: production build, type check, full automated test suite, server smoke test on port 4000, readiness-marker assertion, and harness configuration validation.

## Delivery and Operations

- `npm start` starts only the prepared production server on `0.0.0.0:4000` and does not build or install dependencies.
- `BOOKMARK_DB_PATH` may override the default `data/bookmarks.db` for tests or deployment; tests always use isolated temporary paths.
- Startup runs pending idempotent migrations before accepting requests. A migration failure stops startup with a clear log rather than serving a partially initialized app.
- A lightweight `/api/health` endpoint reports process readiness without exposing database contents.
- The client root receives `data-harness-ready="true"` only after the initial collection request has resolved to a valid loaded or empty state; loading and error placeholders are not marked ready.
- After dependencies, builds, migrations, and validation succeed, `.harness/app.json` will declare the application on port 4000 with `start_command: ["npm", "start"]` and `start_cwd: "/work"`.

## Complexity Tracking

No constitution violations or complexity exceptions are present.
