# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a private, single-user web application that saves bookmarks from a pasted URL, retrieves and safely stores page metadata, supports an explicit read-later workflow, provides Boolean and exact-tag search over a 10,000-item library, and enables rich notes and transactional bulk organization.

The implementation will be a single TypeScript application: a React client built by Vite and served by a Fastify process that also exposes the JSON API. SQLite supplies durable local storage and FTS5 search. The server will fetch metadata through an SSRF-resistant request boundary, parse markup without executing page scripts, and cache bounded icon/preview assets locally. A custom search parser will turn the product's documented query language into a parameterized set-expression query rather than passing user syntax directly to SQL.

## Technical Context

**Language/Version**: Node.js 24 LTS; TypeScript 5.x

**Primary Dependencies**: React 19.3, Vite 8.3, Fastify 5.x, `better-sqlite3` 13.x, Cheerio 1.x, Undici 7.x, Tiptap 3.x, Zod 4.x, and `file-type` 21.x for bounded media signature checks

**Storage**: SQLite 3.53+ on local disk in WAL mode, with foreign keys, versioned SQL migrations, FTS5 indexes, and a bounded local asset directory for cached site icons and preview images

**Testing**: Vitest 5 for unit and component tests; Fastify injection plus temporary SQLite databases for integration and contract tests; Playwright 1.61.0 for end-to-end keyboard and browser workflows; `@axe-core/playwright` for automated accessibility checks

**Target Platform**: Linux-hosted responsive web application; current baseline desktop and mobile browsers; HTTP server bound to `0.0.0.0:4000`

**Project Type**: Single full-stack web application and one deployable Node.js process

**Performance Goals**: User-visible search/filter/sort updates within 1 second at 10,000 bookmarks for at least 95% of runs; responsive metadata preview within 5 seconds for at least 95% of eligible pages, with a hard recoverable result by 10 seconds; bulk mutation of 100 bookmarks within 30 seconds

**Constraints**: No authentication or cross-device synchronization; one application instance and one local database writer; metadata fetches limited to public HTTP(S) destinations with DNS and redirect revalidation; no remote script execution; metadata and note content rendered from allowlisted structured data; bookmark saves remain possible when metadata retrieval fails

**Scale/Scope**: One user, one device/server, 10,000 bookmarks, up to 20 tags per bookmark, explicit multi-selection of up to 100 bookmarks per bulk request, and four primary UI surfaces (active library, unread library, archived library, create/edit panel)

## Constitution Check

*GATE: Passed before research and passed again after Phase 1 design.*

- `.specify/memory/constitution.md` is an unratified placeholder and defines no enforceable project-specific principles.
- The repository-level SDD gate is satisfied: the specification is written, quality-checked, and explicitly approved before this plan.
- No unresolved product or technical clarification markers remain.
- The design uses one application process and one database, keeping the architecture proportionate to the single-user scope.
- Security-sensitive metadata retrieval and irreversible deletion have explicit boundaries and validation contracts.
- Post-design re-check: the data model, API contract, search grammar, and validation guide remain inside the approved scope and introduce no constitution violation.

## Design Overview

### Runtime boundaries

1. The React client owns presentation state: current view, query text, tag filters, sort, form drafts, and current explicit selection.
2. Fastify validates all request and response bodies, coordinates bookmark transactions, serves the production client bundle, and listens on `0.0.0.0:4000`.
3. The bookmark service owns normalization, duplicate detection, lifecycle transitions, tag reuse, bulk action rules, note validation, and FTS synchronization.
4. The metadata service uses a restricted fetch transport, validates every DNS result and redirect target, caps time and bytes, extracts only allowlisted text and image candidates, and produces a short-lived preview record.
5. SQLite is the source of truth. Bookmark, tag, join-table, preview, and search-index changes occur transactionally. Cached media files are addressed by content hash and reconciled with database ownership.

### Search execution

The client submits the user's original query unchanged. A server-side tokenizer and recursive-descent parser produce a typed abstract syntax tree for terms, quoted phrases, exact `#tag` expressions, `NOT`, `AND`, `OR`, and parentheses. Adjacent operands are normalized to `AND`. Each text leaf becomes a parameterized FTS5 row-id set; each tag leaf becomes a parameterized join-table row-id set; Boolean nodes combine sets using `INTERSECT`, `UNION`, and universe-minus-set operations. Lifecycle, reading-state, explicit tag filters, sorting, and pagination are applied outside that expression. Parse failures return an offset and friendly correction message without modifying the submitted query.

### Metadata preview and saving

Pasting or changing a URL starts a cancellable metadata-preview request after URL validation. The fetcher resolves and pins a public address, follows at most five redirects with the same checks, accepts only bounded HTML, and never executes page JavaScript. It extracts Open Graph fields first, then Twitter/page metadata, then standard title/description/icon fallbacks. Eligible images are separately fetched through the same safe transport, type-checked, size-capped, and cached. The response includes a preview token, editable text, local media identifiers, status, and warnings. Saving claims the preview atomically; an expired or failed preview falls back to a generated hostname/path title.

### Rich notes and safe rendering

The editor stores a constrained Tiptap JSON document rather than arbitrary HTML. Client and server both allow only paragraphs, text, bold, italic, bullet lists, ordered lists, list items, and HTTP(S) links. The server rejects unknown nodes/marks, normalizes links, enforces the 5,000-readable-character limit, and derives plain text for FTS. Read-only notes are rendered from this validated structure without raw HTML insertion.

### Bulk actions

Selections remain client-side and are cleared when the view or query context changes. A bulk request contains no more than 100 explicit public bookmark IDs and one action. The service evaluates each item, performs valid updates in one transaction, refreshes affected search rows once, and returns changed, unchanged, and failed IDs. Permanent deletion requires archived state and an explicit `confirmed: true` flag in addition to the client confirmation dialog.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── search-grammar.md
└── tasks.md                  # Created only by speckit-tasks after plan approval
```

### Source Code (repository root)

```text
package.json
package-lock.json
tsconfig.json
vite.config.ts
playwright.config.ts
src/
├── client/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── bookmarks/
│   │   ├── editor/
│   │   ├── search/
│   │   └── tags/
│   ├── lib/
│   ├── styles/
│   └── main.tsx
├── server/
│   ├── app.ts
│   ├── index.ts
│   ├── api/
│   ├── db/
│   ├── metadata/
│   ├── repositories/
│   ├── search/
│   └── services/
└── shared/
    ├── contracts/
    ├── schemas/
    └── types/
db/
├── migrations/
└── seeds/
data/
├── bookmark-manager.sqlite  # Runtime-generated and ignored
└── assets/                  # Runtime-generated and ignored
tests/
├── unit/
├── component/
├── integration/
├── contract/
├── e2e/
├── accessibility/
├── performance/
└── fixtures/
```

**Structure Decision**: Use one npm package and one production server so the client and API share validation types without introducing a monorepo or separate deployment. Domain logic remains isolated under `src/server/services`, storage under repositories and migrations, and security-sensitive fetching under `src/server/metadata`. Tests are separated by verification boundary rather than mirroring every source directory.

## Implementation Sequence

1. Establish the TypeScript/Vite/Fastify application shell, shared validation contracts, database migration runner, production static serving, and health/readiness behavior.
2. Implement the schema, repositories, normalized URLs and tags, bookmark lifecycle transitions, FTS synchronization, search parser/compiler, sorting, and pagination.
3. Implement the restricted metadata transport, extractor, bounded media cache, preview-token lifecycle, and address-derived fallback titles.
4. Implement the active/unread/archived library UI, create/edit flow, metadata preview states, bookmark cards, tag autocomplete, clickable tag filtering, and sorting.
5. Add constrained rich-note editing and rendering, then selection and transactional bulk actions including confirmed archive-only deletion.
6. Complete empty/error states, keyboard behavior, responsive layout, accessibility semantics, and visible `data-harness-ready="true"` readiness after initial data load.
7. Add unit, integration, contract, end-to-end, accessibility, and 10,000-bookmark performance verification; build the production bundle and configure `.harness/app.json` only during implementation.

## Phase 0 and Phase 1 Outputs

- [research.md](./research.md): technology, security, search, storage, metadata, rich-text, and testing decisions.
- [data-model.md](./data-model.md): persistent and transient entities, constraints, indexes, and state transitions.
- [contracts/openapi.yaml](./contracts/openapi.yaml): HTTP interface contract for the client and server.
- [contracts/search-grammar.md](./contracts/search-grammar.md): exact user-query grammar and evaluation contract.
- [quickstart.md](./quickstart.md): post-implementation setup and end-to-end validation procedure.

## Plan Gate

This plan and its Phase 0/1 artifacts are ready for client review. Task generation and implementation remain blocked until the plan is approved.
