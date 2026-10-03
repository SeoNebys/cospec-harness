# Implementation Plan: Bookmark Management

**Branch**: `[001-manage-bookmarks]` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-manage-bookmarks/spec.md`

## Summary

Build a responsive, single-user bookmark manager that enriches submitted URLs with page metadata; persists bookmarks, tags, reading state, favorite state, and archive state; and supports search, filtering, and sorting. The implementation will use a single full-stack TypeScript web application, server-rendered initial views, JSON mutation/query endpoints, and a local SQLite database. Metadata retrieval runs only on the server and applies strict network-safety, response-size, redirect, and timeout controls.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24

**Primary Dependencies**: Next.js 16, React 19, Zod for boundary validation, Cheerio for HTML metadata parsing

**Storage**: SQLite through Node.js's built-in SQLite interface; database file stored in a configurable application-data path

**Testing**: Vitest for unit and service integration tests; Playwright 1.61.0 for browser acceptance tests

**Target Platform**: Linux-hosted web application accessed from current desktop and mobile browsers

**Project Type**: Full-stack web application in a single repository and deployable process

**Performance Goals**: Search/filter/sort results visible within 2 seconds for 10,000 bookmarks; ordinary local mutations reflected within 500 ms; metadata preview completes or returns an actionable timeout within 8 seconds

**Constraints**: Listen on `0.0.0.0:4000`; single configured library; HTTP/HTTPS destinations only; persistent local data; responsive and keyboard-accessible UI; server-side URL retrieval must prevent access to loopback, private, link-local, multicast, and otherwise non-public network targets

**Scale/Scope**: One personal library, at least 10,000 bookmarks, five primary views (Library, To Read, Favorites, Archive, Add/Edit), no accounts or cross-device synchronization in this feature

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The constitution file contains only unratified template placeholders, so it defines no enforceable project-specific gates. The repository-level SDD rules remain binding:

- Specification was written, revised, validated, and explicitly approved before planning: **PASS**.
- Plan contains no implementation and will be presented for approval before task generation or coding: **PASS**.
- All approved behavior is traceable through the data model, interface contract, and quickstart scenarios: **PASS**.
- The proposed runtime uses `0.0.0.0:4000` and will provide the required readiness marker and harness manifest during implementation: **PASS**.

Post-design re-check: the artifacts introduce no scope outside the approved specification and no constitution violation. **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-bookmarks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── bookmarks/
│   ├── metadata/
│   └── tags/
├── bookmarks/[id]/edit/
├── archive/
├── favorites/
├── to-read/
├── layout.tsx
└── page.tsx

components/
├── bookmarks/
├── filters/
└── ui/

lib/
├── bookmarks/
├── metadata/
├── db/
├── validation/
└── view-models/

public/
└── fallback-site-icon.svg

tests/
├── unit/
├── integration/
└── e2e/

scripts/
└── initialize-database.ts

data/
└── .gitkeep
```

**Structure Decision**: Use one Next.js application so the UI and server-only capabilities share types and one deployment process. Route handlers form the application boundary; domain modules hold bookmark rules, metadata safety, and persistence; React components remain focused on presentation and interaction. SQLite data is kept outside source modules and its location is configurable for production and isolated tests.

## Design Decisions

### Request and rendering flow

Initial page requests load a server-rendered bookmark view from query parameters. Search, filter, sort, and navigation state remain represented in the URL so views are linkable and browser navigation works. Client components provide optimistic-feeling controls but reconcile every mutation with the authoritative server result.

### Metadata preview flow

The add form submits a candidate URL to the metadata-preview endpoint. The server normalizes and validates the URL, resolves its host, rejects non-public targets, follows a small bounded number of redirects while revalidating every target, downloads a bounded HTML response with a timeout, and extracts title, description, icon, and preview-image candidates. The user reviews editable text fields before saving. Missing or inaccessible fields return explicit warnings and fallback presentation rather than blocking creation.

### Persistence and querying

SQLite holds bookmarks, canonical tags, and bookmark/tag links. Archive and reading states are explicit fields rather than inferred from other data. Parameterized queries implement view scope, combined filters, stable sorting, and paginated results. Mutations run in transactions where tags and bookmarks change together.

### Validation and error behavior

Zod schemas validate route inputs and produce field-addressable problems. Domain rules are repeated at the persistence boundary where consistency matters. Expected failures use the common problem contract; form state is retained client-side on recoverable errors. Permanent deletion requires a separate confirmation action in the UI.

### Verification strategy

Unit tests cover URL normalization, tag normalization, metadata selection, SSRF checks, and state transitions. Integration tests exercise database queries, transactions, duplicate detection, and route contracts against isolated temporary databases. Playwright tests cover the approved journeys at desktop and mobile viewports, including metadata success/fallback, read-later, archive/restore/delete, filters, persistence across reload, and accessible keyboard operation.

## Complexity Tracking

No constitution violations require justification.
