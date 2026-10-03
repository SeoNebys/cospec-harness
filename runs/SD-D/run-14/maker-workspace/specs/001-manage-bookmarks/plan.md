# Implementation Plan: Bookmark Manager

**Branch**: `001-manage-bookmarks` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-manage-bookmarks/spec.md`

## Summary

Build a self-hosted, single-user web application that saves and organizes bookmarks, enriches them from public pages, captures one current visual snapshot per bookmark, tracks reading state, supports bulk maintenance, and evaluates a small explicit search language. A React client will consume a schema-validated Fastify API. SQLite stores structured data and search state; captured images live in an application-owned data directory. Metadata and snapshot work runs asynchronously through a bounded in-process worker whose pending jobs are persisted and resumed after restart.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 LTS; browser-targeted TypeScript for the client

**Primary Dependencies**: React 19, Vite 7, Fastify 5, TypeBox schemas/type provider, Drizzle ORM, `better-sqlite3`, Playwright 1.61.0 with Chromium, Vitest, React Testing Library

**Storage**: SQLite database under `data/`; locally downloaded favicon/preview assets and WebP page snapshots under `data/assets/`; schema migrations committed to the repository

**Testing**: Vitest for unit/component tests, Fastify injection tests for HTTP contracts, temporary SQLite databases for repository integration tests, and Playwright 1.61.0 for end-to-end/browser and capture tests

**Target Platform**: Linux container/server; responsive web client for current desktop and mobile browsers; HTTP server binds `0.0.0.0:4000`

**Project Type**: Web application with a browser client, HTTP API, and same-process background capture worker

**Performance Goals**: Search/filter/sort result updates under one second for 10,000 bookmarks; ordinary API reads under 250 ms at p95 on the review environment; metadata and snapshot completion or an explanatory terminal state within 30 seconds for representative permitted pages

**Constraints**: Single user and single application process; no accounts or external queue; one latest snapshot per bookmark; live retrieval restricted to public HTTP(S) destinations; enrichment failures never prevent a valid bookmark from being managed; snapshots must remain viewable without the source page

**Scale/Scope**: One installation, up to 10,000 bookmarks, tens of thousands of tag associations, one current snapshot and cached metadata asset set per bookmark, five primary UI areas (collection, unread, archived, saved views, settings)

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The repository constitution is still an unratified template and defines no enforceable project principles. The applicable repository rules are therefore the approved specification, gated Spec-Driven Development workflow, and runtime contract in `AGENTS.md`.

- **Specification gate**: PASS — `spec.md` is explicitly approved and all planned behavior traces to it.
- **Plan-before-code gate**: PASS — this phase creates design artifacts only; no application code or task breakdown is created.
- **Scope gate**: PASS — accounts, sharing, sync, browser extensions, import/export, snapshot history, and collaborative features remain excluded.
- **Runtime gate**: PASS — the design exposes the final app on `0.0.0.0:4000` and provides a foreground `npm start` command suitable for `.harness/app.json`.
- **Verification gate**: PASS — unit, contract, integration, and browser-level checks cover the risky parsing, persistence, network retrieval, capture, and bulk-action paths.
- **Security gate**: PASS — public-only URL policy, redirect revalidation, private-network blocking, bounded downloads, safe content serving, and destructive-action confirmation are part of the design.

Post-design re-check: PASS. The data model, contracts, and quickstart preserve the approved scope and introduce no constitutional or workflow violation.

## Architecture and Design

### Request path

The React client uses `/api` JSON endpoints served by Fastify from the same origin. Route schemas are the contract boundary. Business services own validation and transactions; repositories own SQLite statements. The server serves the built client and locally stored image assets with fixed content types and identifiers rather than caller-supplied paths.

### Enrichment and snapshot pipeline

Creating a bookmark commits the bookmark immediately with `metadata_status` and `snapshot_status` set to `pending`, then persists one capture job. A bounded worker processes at most two jobs concurrently and resumes pending/processing jobs on startup. It:

1. Normalizes and validates the destination and each redirect as public HTTP(S), rejecting loopback, link-local, private, reserved, metadata-service, and non-network schemes for both IPv4 and IPv6.
2. Opens an isolated Chromium context with no stored credentials, download permission, service-worker persistence, or cross-job state; request interception rechecks subresource destinations and enforces time, byte, redirect, and page-height limits.
3. Reads title, description, icon, and preview candidates from standard document metadata, applies deterministic fallbacks, and downloads accepted visual assets into application-owned storage.
4. Captures a full-page WebP image at a fixed desktop viewport. Extremely long or oversized pages are capped and marked `partial`; an image still counts as a viewable dated snapshot.
5. Commits metadata only into fields not marked user-edited, replaces the previous snapshot only after a successful explicit refresh, records terminal status/error details, and removes superseded files after the database transaction succeeds.

This visual snapshot choice directly represents what the public page looked like while avoiding execution of archived third-party scripts. It intentionally does not reproduce interactive behavior, authenticated content, or media playback.

### Search language

A hand-written tokenizer and recursive-descent parser produce a typed abstract syntax tree; raw query text is never interpolated into SQL. Tokens are plain terms, quoted phrases, exact `#tags`, `NOT`, `OR`, and parentheses. Adjacent expressions imply AND. Precedence is parentheses, NOT, AND, OR. The compiler emits parameterized predicates across bookmark fields and tag membership, allowing NOT-only queries and ensuring phrases match within one field. Parsing has length, token-count, and nesting-depth limits and returns a source position plus user-facing message on invalid input. The normative grammar is in `contracts/search-grammar.md`.

### Bulk-action consistency

Selection is represented as either explicit bookmark IDs or an all-results descriptor containing the current query and filters plus exclusions. The API recomputes the matching set and count at confirmation/execution time. Each bulk action runs in one SQLite transaction, returns affected and failed counts, and uses the same normalized query compiler as list views. Delete removes database rows transactionally and then safely removes associated files; missing files are tolerated and reported for cleanup without restoring deleted records.

### Storage and lifecycle

SQLite runs in WAL mode with foreign keys enabled and short transactions. Database rows contain metadata, state, saved-view definitions, preferences, and asset identifiers; large image bytes stay out of SQLite. Startup applies forward migrations, creates the controlled data directories, recovers interrupted jobs, and reconciles orphaned temporary files. Temporary capture files are written in the target filesystem and atomically renamed only after successful capture.

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-bookmarks/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.yaml
│   ├── search-grammar.md
│   └── ui-contract.md
└── tasks.md                 # created only in the tasks phase
```

### Source Code (repository root)

```text
package.json
package-lock.json
tsconfig.base.json
apps/
├── server/
│   ├── src/
│   │   ├── api/            # Fastify routes and schemas
│   │   ├── capture/        # URL policy, metadata extraction, snapshots, worker
│   │   ├── db/             # connection, migrations, repositories
│   │   ├── domain/         # services and state transitions
│   │   ├── search/         # tokenizer, parser, AST, SQL compiler
│   │   ├── storage/        # controlled asset paths and file lifecycle
│   │   └── server.ts
│   └── tests/
│       ├── contract/
│       ├── integration/
│       └── unit/
└── web/
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── features/
    │   │   ├── bookmarks/
    │   │   ├── bulk-actions/
    │   │   ├── saved-views/
    │   │   ├── search/
    │   │   └── settings/
    │   ├── pages/
    │   ├── styles/
    │   └── main.tsx
    └── tests/
packages/
└── contracts/              # shared TypeBox schemas and generated/inferred types
tests/
├── e2e/
├── fixtures/
└── capture-site/           # deterministic local pages for permitted capture tests
data/                       # runtime-only; ignored except placeholder/docs
```

**Structure Decision**: Use npm workspaces for a small monorepo with separate server and web applications plus one shared contracts package. The split keeps browser and server dependencies isolated while sharing request/response types. The capture worker stays inside the server process because this is a single-user installation; its persisted jobs provide restart safety without adding an external broker.

## Verification Strategy

- **Unit**: URL normalization and public-address policy, metadata candidate selection, search tokenization/parsing/precedence, AST-to-predicate compilation, state transitions, and file-key validation.
- **Component**: save form progress/failure behavior, read-later controls, query errors, tag suggestions, selection/all-results affordance, destructive confirmations, sorting, saved views, and persisted appearance/density.
- **Contract**: every route validates request and response payloads against the OpenAPI-aligned TypeBox schemas; error codes and bulk selection forms are exercised.
- **Integration**: migrations, cascade behavior, user-edit protection during refresh, job recovery, atomic snapshot replacement, saved-view reevaluation, NOT-only/grouped searches, transactional bulk actions, and file cleanup.
- **End to end**: deterministic fixture pages prove metadata extraction and snapshot display; complete user journeys cover save, unread/read, complex search, saved views, bulk tag/archive/delete, sorting, preferences, and restart persistence.
- **Security regression**: reject local/private/reserved targets and private redirects, enforce response limits and timeouts, prevent path traversal, serve snapshots as inert images, and prove malformed search input never becomes SQL.

## Delivery and Operations

- `npm run build` prepares both workspaces; `npm start` launches the built server on `0.0.0.0:4000` and serves the client.
- `BOOKMARK_DATA_DIR` may select a directory under the deployment's writable storage; the default is `./data`. The server refuses a data path that resolves inside built static assets.
- Health and readiness endpoints distinguish process availability from completed database migrations and worker initialization.
- Structured logs include request IDs and capture job IDs but exclude bookmark notes, full query text, and downloaded page content.
- Graceful shutdown stops accepting work, allows a bounded interval for current transactions, marks unfinished jobs pending, closes Chromium, and checkpoints/closes SQLite.
- When implementation is review-ready, create `.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` and expose `data-harness-ready="true"` only after the client has loaded its initial valid state.

## Complexity Tracking

No constitution violations require justification. The only deliberate multi-part structure is the minimum web client/server boundary plus shared schemas. A separate queue service, authentication service, search server, object store, and snapshot-history subsystem are intentionally excluded.
