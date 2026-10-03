# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a private, responsive bookmark-management web application as a React single-page client and a same-origin Fastify API. The application will persist user-scoped bookmark data in SQLite, use a deliberately small search-language parser backed by FTS5, retrieve publisher metadata through an SSRF-resistant fetch boundary, and serve the built client and API from one Node.js process on `0.0.0.0:4000`. The design includes explicit read/archive states, searchable Markdown notes, transaction-safe bulk operations, and reusable saved views. Full-page snapshots remain deferred.

## Technical Context

**Language/Version**: Node.js 24.21.x, TypeScript 5.9.x, ECMAScript modules

**Primary Dependencies**: React 19.3, Vite 8.3, React Router 7.18, TanStack Query 5.103, Fastify 5.12, Zod 4.6, Drizzle ORM 0.45, better-sqlite3 13.0, Undici 8.11, Cheerio 1.2, react-markdown 10.1, rehype-sanitize 6.0

**Storage**: SQLite 3 with WAL mode, foreign keys, committed SQL migrations, and an FTS5 external-content index; bounded on-disk cache for fetched icon and preview-image bytes

**Testing**: Vitest 5 for unit and integration tests, Fastify `inject()` for API tests, React Testing Library 16 and user-event 14 for component tests, Playwright 1.61.0 for browser workflows

**Target Platform**: Single-node Linux server; modern evergreen desktop and mobile browsers; HTTP review runtime at `0.0.0.0:4000`

**Project Type**: Full-stack web application with a React SPA and same-origin JSON API

**Performance Goals**: Search, filter, archive, and saved-view results visible within 1 second for a 10,000-bookmark library; metadata review available within 5 seconds for supported public pages; interactive UI updates remain responsive during network and bulk operations

**Constraints**: Every data access is scoped to the authenticated user; external metadata retrieval must resist SSRF and DNS rebinding; metadata failure cannot block saving; archived records are excluded structurally from active/unread queries; bulk confirmation must bind to an exact count and unchanged library revision; user Markdown cannot execute HTML or scripts

**Scale/Scope**: First-release single-node deployment, multiple private users, up to 10,000 bookmarks per user, result pages of at most 100 items, and bulk actions across a user's full matching set

## Constitution Check

*GATE: Passed before research and passed again after design.*

The project constitution is still an unratified template and contains no enforceable project-specific principles. The repository's active development rules require spec-driven delivery, approval gates, preserved artifacts, proportional verification, and a final server on port 4000. This plan complies:

- The feature specification is approved and remains the behavioral source of truth.
- This phase produces research, data design, interface contracts, and validation guidance only; it does not implement the application.
- Tasks and implementation remain behind their later workflow gates.
- The planned production-like runtime uses one foreground command, binds `0.0.0.0:4000`, and will expose the required readiness marker only after initial UI/session data loads.
- Security-sensitive URL retrieval, destructive bulk operations, tenant isolation, and data persistence receive dedicated contract and test coverage.

Post-design re-check: no constitutional or repository-policy violation was introduced by the data model, API contract, or quickstart. No complexity exception is required.

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
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md                 # Created only in the tasks phase
```

### Source Code (repository root)

```text
src/
├── client/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── bookmarks/
│   │   ├── bulk-actions/
│   │   ├── collections/
│   │   ├── saved-views/
│   │   ├── search/
│   │   └── tags/
│   ├── routes/
│   └── styles/
├── server/
│   ├── api/
│   ├── auth/
│   ├── db/
│   │   ├── migrations/
│   │   └── repositories/
│   ├── metadata/
│   ├── search/
│   └── services/
└── shared/
    ├── contracts/
    ├── schemas/
    └── types/

data/
└── .gitkeep

tests/
├── contract/
├── e2e/
├── integration/
├── fixtures/
│   └── metadata-sites/
└── unit/

public/
scripts/
```

**Structure Decision**: Use one npm package and one deployable Node process. Vite builds the client into `dist/client`; TypeScript builds the server into `dist/server`; Fastify serves both the JSON API and SPA fallback. Feature folders keep UI behavior cohesive, while server repositories, search compilation, and metadata networking remain isolated behind testable boundaries. A single package avoids workspace overhead for this first release while `src/shared` prevents duplicated request/response types.

## Design Decisions

- **Persistence boundary**: Drizzle defines ordinary tables and migrations; narrowly scoped repository SQL handles FTS5, set algebra, and transaction-heavy bulk operations that an ORM does not express cleanly.
- **Search boundary**: A lexer and recursive-descent parser produce a versioned AST. The compiler binds every value and uses a user/location-filtered universe plus FTS and tag ID sets, so Boolean negation cannot escape tenant or archive scope.
- **Metadata boundary**: The API never performs an unrestricted fetch. Each redirect is parsed, DNS-resolved, classified, pinned to the validated public address, bounded by time and size, and parsed without executing page code.
- **Media boundary**: The client requests icons/previews by owned bookmark ID. The server retrieves or serves bounded cached image bytes after repeating destination checks; it never exposes an arbitrary proxy URL.
- **Bulk consistency**: Preview returns an exact count, canonical criteria hash, and per-user library revision. Execution starts a write transaction and refuses stale previews before materializing the target IDs once.
- **Authentication boundary**: A pre-seeded review account and sign-in/session endpoints make the planned app reviewable. Registration and recovery remain outside this feature. Every repository method takes a user ID; uniqueness rules include it.
- **Offline-copy boundary**: Only small metadata images may be cached. HTML, scripts, article text, and other page content are not retained, keeping the possible future full-page snapshot capability outside this release.

## Complexity Tracking

No constitution violations require justification. The custom search parser and guarded metadata client are necessary boundaries derived directly from approved requirements and security constraints, not optional architectural layers.
