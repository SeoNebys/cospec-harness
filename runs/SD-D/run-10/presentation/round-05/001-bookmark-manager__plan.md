# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a responsive, account-based bookmark manager as one TypeScript web application. A React client provides capture, library, detail, Read Later, archive, saved-search, and bulk-management workflows. A Fastify server owns authentication, validation, metadata retrieval, search compilation, transactional bulk actions, and a versioned JSON API. SQLite stores application data and an FTS5 index; app-managed local media storage caches retrieved icons and preview images. The production build is served by the same Fastify process on `0.0.0.0:4000`.

The design deliberately keeps browser import/export and saved copies of full page content outside v1, while leaving room to add them later without changing bookmark identity or organization.

## Technical Context

**Language/Version**: Node.js 24 LTS; TypeScript 5.9; browser-side HTML/CSS

**Primary Dependencies**: React 19.3, Vite 8, Fastify 5.12, `better-sqlite3` 13, Zod 4, Cheerio 1.2, Argon2, `react-markdown`, `rehype-sanitize`

**Storage**: One SQLite database in WAL mode for relational data, sessions, and FTS5 search; application-managed files under `data/assets/` for cached site icons and preview images; SMTP-compatible provider for production recovery email

**Testing**: Node test runner for server and domain units; React Testing Library with Vitest for UI components; Fastify request injection for API integration tests; Playwright 1.61.0 with the shared Chromium installation for end-to-end and phone/desktop checks

**Target Platform**: Linux server with modern evergreen desktop and mobile browsers; production/review HTTP process listens on `0.0.0.0:4000`

**Project Type**: Responsive single-page web application plus same-origin JSON API, built and deployed as one service

**Performance Goals**: Metadata proposals for representative pages within 3 seconds; search/filter/sort updates within 1 second at 10,000 bookmarks; exact bulk accounting for selections up to at least 1,000 items

**Constraints**: Private per-user data; safe fetching of user-supplied public URLs; archived items excluded from active results; permanent deletion explicit and irreversible; optimistic concurrency on mutable records; no required external database; application must remain savable when metadata retrieval fails

**Scale/Scope**: Initial single-instance deployment, personal libraries of at least 10,000 bookmarks per user, multiple user accounts, roughly 12 primary screens/dialogs, and one API service; horizontal multi-instance deployment is not a v1 goal

## Constitution Check

*GATE: Evaluated before research and re-evaluated after design.*

The repository constitution is an unratified placeholder and defines no project-specific engineering principles. The binding project workflow in `AGENTS.md` requires Spec-Driven Development and the runtime presentation contract.

### Pre-Research Gate

- **Approved specification exists**: PASS — the client approved `spec.md` on 2026-09-18.
- **Planning precedes implementation**: PASS — this phase creates design artifacts only; no application code is being written.
- **Plan remains within approved scope**: PASS — import/export, browser extensions, offline access, full-page archival, sharing, and collaboration remain excluded.
- **Runtime delivery is accounted for**: PASS — the plan uses one foreground `npm start` service on `0.0.0.0:4000` and reserves the required readiness marker and harness manifest for implementation.

### Post-Design Gate

- **Artifacts trace to the approved scenarios and requirements**: PASS — the data model, API contract, search grammar, and quickstart map the approved flows without adding product scope.
- **Security-sensitive integrations are designed before coding**: PASS — session handling, CSRF, password hashing, recovery-token storage, SSRF controls, media validation, and safe note rendering are specified in `research.md` and the contracts.
- **No unresolved clarification remains**: PASS — all technology and behavior decisions needed for task generation are recorded in `research.md`.
- **Complexity is justified by requirements**: PASS — the single-service architecture, SQLite database, and local media store are the smallest deployment shape that supports authenticated ownership, search, metadata caching, and transactional bulk actions.

## Architecture and Design Decisions

### Application Boundary

Fastify serves both `/api/*` and the built React application, keeping cookies same-origin and deployment to one process. Route handlers validate input and delegate to domain services; repositories are the only modules that issue SQL. Shared schemas define request/response types used by both client and server.

### Authentication and Ownership

Passwords are hashed with Argon2id. Opaque random session tokens are stored only as hashes in SQLite and sent in host-scoped, HTTP-only, same-site cookies. State-changing API calls require a session-bound CSRF token and accepted same-origin request metadata. Every owned-resource query includes the authenticated user ID; public IDs prevent exposing internal row identifiers. Recovery tokens are random, single-use, hashed at rest, short-lived, and delivered through a mail-provider interface.

### Metadata and Media Capture

Metadata retrieval is server-side. It accepts only HTTP(S), resolves every host and redirect hop, blocks non-public IPv4/IPv6 destinations, applies redirect/timeout/body limits, and accepts HTML only for page parsing. Open Graph values are preferred, with standard HTML and Twitter-card fallbacks. Icon and preview candidates are separately fetched through the same public-network checks, validated by content type and size, and stored as user-owned draft media. Saving a bookmark promotes selected draft assets; expired or unreferenced drafts are cleaned up.

### Search

A small lexer/parser converts the user syntax into an internal expression tree. Text terms and phrases compile to parameterized FTS5 predicates; `#tag` terms compile to exact normalized-tag predicates; `NOT`, `AND`, and `OR` compile recursively with the approved precedence. The application never forwards the user's raw expression directly to SQLite. Outer predicates always enforce owner and active/archive context. Bookmark and tag mutations update the search index in the same transaction.

### Bulk Safety and Concurrency

Individual selections carry explicit bookmark public IDs. “All matches” selections carry a normalized query/filter snapshot. Preview returns an expiring confirmation token, criteria digest, exact count, and eligible/ineligible breakdown. Execution recalculates the set transactionally; destructive or archival requests that changed in count return a conflict and require reconfirmation. Mutable records use a version number so stale edits return a conflict instead of overwriting newer changes.

### Notes

Notes are stored as Markdown and edited through a plain-text editor with formatting controls and live preview. Raw HTML is disabled. Rendering uses an allowlisted Markdown pipeline and safe link handling, covering only the formats approved in the spec.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-api.md
│   └── search-syntax.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── client/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   ├── bookmarks/
│   │   ├── bulk-actions/
│   │   ├── collections/
│   │   ├── saved-searches/
│   │   ├── search/
│   │   └── tags/
│   ├── pages/
│   └── styles/
├── server/
│   ├── api/
│   ├── auth/
│   ├── config/
│   ├── db/
│   ├── domain/
│   ├── media/
│   ├── metadata/
│   ├── repositories/
│   ├── search/
│   └── server.ts
└── shared/
    ├── contracts/
    ├── schemas/
    └── types/

migrations/
├── 001_initial.sql
└── fixtures/

tests/
├── contract/
├── e2e/
├── integration/
├── performance/
└── unit/

data/
├── assets/
└── .gitkeep
```

**Structure Decision**: Use one npm package and one deployable service. Client, server, and shared boundary types remain distinct under `src/`, while migrations and all test levels are top-level and discoverable. This avoids a monorepo or separate frontend/backend deployments without mixing browser-only and server-only modules.

## Delivery Sequence

1. Establish the package, quality tooling, configuration validation, database migration runner, and single-process production server.
2. Implement identity, sessions, recovery-provider boundary, CSRF enforcement, and ownership tests.
3. Implement bookmark, tag, collection, state, note, media, and optimistic-concurrency foundations.
4. Add SSRF-hardened metadata and media capture with failure fallbacks.
5. Add the search parser, FTS indexing, filters, archive context, sort, and saved searches.
6. Add bulk previews/execution with reconfirmation and per-item outcome accounting.
7. Build responsive client workflows in user-story order, then accessibility and empty/error states.
8. Complete contract, integration, security, performance, and Playwright validation; generate `.harness/app.json` only after the production build and startup command are verified.
