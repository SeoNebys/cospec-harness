# Implementation Plan: Bookmark Manager

**Branch**: 001-bookmark-manager | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification at specs/001-bookmark-manager/spec.md

## Summary

Deliver a private, responsive bookmark-management web application in which users can paste a URL, safely preview and edit retrieved page metadata, organize links with tags and states, use read-later and archive workflows, search exact phrases and combined tags, sort results, and import or export their collection.

The implementation is one same-origin TypeScript application. React provides the browser UI; Fastify provides a validated JSON API and serves the production client; SQLite stores accounts, bookmarks, tags, sessions, import previews, icons, and a full-text search index. Security boundaries are explicit around user isolation, cookie sessions, untrusted imports, and server-side URL retrieval.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node.js 24.21; HTML/CSS for the browser interface

**Primary Dependencies**: React 19.3, React Router 8.3, Vite 8.3, Fastify 5.12, TypeBox/Fastify type provider, Undici, parse5, Sharp, @fastify/cookie, @fastify/multipart, and @fastify/static

**Storage**: SQLite 3 through Node's built-in node:sqlite; file-backed database and app-owned PNG icon blobs

**Testing**: Vitest 5, React Testing Library, Fastify inject(), and @playwright/test 1.61.0

**Target Platform**: Linux server running one Node process; evergreen desktop and mobile browsers

**Project Type**: Same-origin full-stack web application

**Performance Goals**:

- Preview available metadata within 5 seconds for at least 95% of normally accessible public pages.
- Reflect local collection mutations in the UI within 2 seconds.
- Find a known bookmark among 1,000 items within 15 seconds for at least 95% of users.
- Import 1,000 valid bookmarks with an outcome for every entry and no duplicate destinations.

**Constraints**:

- Production server listens on 0.0.0.0:4000 and is started by npm start.
- Metadata fetches must enforce DNS-pinned public-address checks, per-hop redirect validation, content-type checks, and strict time/size budgets.
- Every data query is account-scoped; active and archived bookmarks share one duplicate namespace.
- Complete backup restoration is lossless, versioned, validated before mutation, and permitted only into an empty collection.
- Primary workflows are responsive, keyboard-operable, and meaningfully labelled.
- The initial deployment is single-node and online-only; saved page copies remain a follow-up feature.

**Scale/Scope**: At least 1,000 bookmarks per user; browser import files up to 10 MiB and 20,000 entries; pagination defaults to 50 bookmarks per response

## Constitution Check

*GATE: evaluated before research and re-evaluated after design.*

The repository constitution is an unratified placeholder and contains no enforceable project-specific principles. The governing AGENTS.md requires Spec-Driven Development and runtime presentation conventions.

### Pre-Research Gate

- Approved written specification exists: **PASS**
- Planning began only after explicit client approval: **PASS**
- No implementation was performed during specification or planning: **PASS**
- Proposed server can bind 0.0.0.0:4000 with a foreground start command: **PASS**
- No constitutional violation requires justification: **PASS**

### Post-Design Gate

- Research resolves every technical uncertainty without a NEEDS CLARIFICATION marker: **PASS**
- Data model traces to approved entities, states, privacy, duplicate, and portability requirements: **PASS**
- API and file contracts cover every user story and keep account scope explicit: **PASS**
- Quickstart defines end-to-end validation before implementation is accepted: **PASS**
- Saved page snapshots remain deferred and are not implemented indirectly: **PASS**
- No constitutional violation requires justification: **PASS**

## Project Structure

### Documentation (this feature)

    specs/001-bookmark-manager/
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md
    ├── contracts/
    │   ├── openapi.yaml
    │   ├── backup.schema.json
    │   └── browser-bookmarks.md
    ├── checklists/
    │   └── requirements.md
    └── tasks.md                 # Created only after this plan is approved

### Source Code (repository root)

    package.json
    package-lock.json
    tsconfig.json
    vite.config.ts
    vitest.config.ts
    playwright.config.ts
    migrations/
    ├── 001_initial.sql
    └── 002_search.sql
    src/
    ├── client/
    │   ├── app/
    │   ├── components/
    │   ├── features/
    │   │   ├── auth/
    │   │   ├── bookmarks/
    │   │   ├── collection/
    │   │   ├── imports/
    │   │   └── settings/
    │   ├── routes/
    │   ├── styles/
    │   └── main.tsx
    ├── server/
    │   ├── app.ts
    │   ├── index.ts
    │   ├── config/
    │   ├── db/
    │   ├── repositories/
    │   ├── routes/
    │   ├── services/
    │   │   ├── auth/
    │   │   ├── bookmarks/
    │   │   ├── imports/
    │   │   ├── metadata/
    │   │   └── exports/
    │   └── security/
    └── shared/
        ├── contracts/
        ├── errors/
        └── url/
    tests/
    ├── contract/
    ├── integration/
    ├── unit/
    ├── component/
    ├── e2e/
    └── fixtures/
    data/
    └── .gitkeep

**Structure Decision**: Use one npm package and one deployable process, separated internally into client, server, and shared contract modules. Feature folders own user-facing behavior; server repositories own all SQL; security-sensitive metadata retrieval is isolated behind injectable resolver and transport interfaces so it can be tested deterministically.

## Design Strategy

### Foundation

1. Establish strict TypeScript, linting/formatting, Vite, Fastify, Vitest projects, Playwright, environment validation, and production build/start commands.
2. Add ordered SQLite migrations, migration runner, transaction helpers, temporary-database test support, and repository boundaries.
3. Implement account registration, login, logout, session rotation/expiry, same-origin mutation checks, and per-account authorization.
4. Create the responsive application shell, authenticated routing, error boundaries, loading/empty states, and data-harness-ready behavior.

### P1 — Metadata-Assisted Save

1. Implement URL validation/canonical keys and database duplicate enforcement.
2. Implement the DNS-pinned safe HTTP client with manual redirect and resource budgets.
3. Parse deterministic title/description/icon candidates and rasterize accepted icons to app-owned PNG.
4. Expose metadata preview and bookmark create/read/update/delete contracts.
5. Build the paste-preview-edit-save flow, duplicate redirect, fallbacks, failure preservation, and keyboard validation.

### P2 — Read Later

1. Add explicit none/unread/read transitions with timestamps.
2. Add unread read-later view and reversible mark-read/mark-unread actions.
3. Keep favorites, reading state, and archive state independent in service and UI tests.

### P3 — Search, Filters, and Sorting

1. Maintain FTS5 rows transactionally with bookmark and tag changes.
2. Parse words and quoted phrases into escaped AND-only FTS expressions.
3. Compose account scope, archive scope, all-tags intersection, favorite/read-later filters, deterministic sorting, and pagination.
4. Store active collection controls in URL query parameters so navigation preserves the current view.

### P4 — Organization and Archive

1. Implement case-insensitive tag uniqueness and as-you-type suggestions with prefix-first ordering.
2. Add favorite, edit, archive, restore, and confirmed permanent-delete flows.
3. Preserve read-later history through archive/restore while excluding archived items from active/read-later views.

### P5 — Import and Export

1. Parse browser HTML as inert data under file, entry, depth, URL, and field limits.
2. Store short-lived, user-scoped preview snapshots and commit the exact preview idempotently with per-entry outcomes.
3. Export interoperable browser HTML separately from the lossless versioned JSON backup.
4. Fully validate native backups and restore them atomically only into empty collections.

### Cross-Cutting Verification

1. Enforce schemas on every request and response and return one consistent error shape.
2. Test cross-account denial, CSRF/session behavior, unsafe URL matrices, DNS rebinding, redirect attacks, decompression/size limits, malformed imports, retry idempotency, and backup round trips.
3. Run component accessibility/keyboard tests and Playwright acceptance scenarios at desktop and mobile viewports.
4. Build before delivery, write .harness/app.json for port 4000, start with npm start, and verify the visible readiness marker and review entry path.

