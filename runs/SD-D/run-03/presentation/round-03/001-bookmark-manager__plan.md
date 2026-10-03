# Implementation Plan: Personal Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Status**: Draft — awaiting client approval

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a single-user, full-stack web application that captures bookmarks from an address alone, enriches them asynchronously with safely retrieved page metadata, prevents normalized-address duplicates, and supports Read Later, tags, favorites, archive/restore, advanced search, saved views, formatted notes, and transactional bulk actions. A React single-page client will use a same-origin Fastify JSON API. SQLite will provide durable local storage, uniqueness constraints, indexed search, saved-view data, and snapshot selection sets. One Node.js process will run migrations, serve the API and built client, and listen on `0.0.0.0:4000`.

## Technical Context

**Language/Version**: TypeScript 7.0.2 in strict ESM mode on Node.js 24.21.x LTS

**Primary Dependencies**: React 19.3, Vite 8.3, Fastify 5.12, TypeBox 1.3, better-sqlite3 13.0, Cheerio 1.2, Sharp 0.35, react-markdown 10.1, mdast utilities 2.x/4.x, and `@fastify/static`/`@fastify/helmet`

**Storage**: One local SQLite database managed by ordered SQL migrations; cached, validated site icons stored as deduplicated PNG blobs; no external service

**Testing**: Vitest 5, Fastify injection tests, Testing Library, Playwright 1.61.0 pinned to the supplied browser revision, Axe accessibility checks, deterministic metadata fixtures, and seeded performance tests

**Target Platform**: Linux application server with Node.js 24; current evergreen desktop and mobile browsers down to 320 CSS pixels

**Project Type**: Single-package full-stack web application with a React client, Fastify server, shared contracts, and same-origin API

**Performance Goals**: Search/filter/sort p95 under 1 second at 10,000 bookmarks; supported bulk action on 1,000 bookmarks under 10 seconds; available page metadata displayed within 5 seconds under normal network conditions

**Constraints**: Single user and no authentication; local persistence only; keyboard-accessible responsive interface; strict duplicate uniqueness; metadata jobs must not overwrite user edits; outbound retrieval limited to safe public HTTP(S) targets with bounded resources; app binds to `0.0.0.0:4000`

**Scale/Scope**: Up to 10,000 bookmarks, dozens of tags per bookmark, reusable saved views, one interactive user, one SQLite writer, and seven end-to-end user journeys

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The repository constitution remains an unratified placeholder and defines no enforceable project-specific principles. The governing workspace workflow requires specification approval before planning and plan approval before task generation or implementation.

- Approved specification exists and is the source of requirements: **PASS**
- This phase creates design artifacts only; no application code or dependencies are introduced: **PASS**
- The plan resolves technical unknowns in [research.md](./research.md): **PASS**
- Data, interface, validation, security, and test designs trace to the approved specification: **PASS**
- Task generation and implementation remain blocked pending client approval of this plan: **PASS**

**Post-design re-check**: The data model, API contract, search grammar, and quickstart add implementation detail without altering approved product behavior. No constitutional or SDD gate violation was introduced.

## Technical Approach

### Application Architecture

- Use one npm package and one production Node.js process. Fastify owns startup, migrations, API routes, background metadata work, security headers, built asset delivery, and SPA fallback.
- Keep browser and server boundaries explicit under `src/client` and `src/server`; place TypeBox request/response schemas, DTOs, enums, and search AST types in `src/shared`.
- Use a small typed fetch client and feature-local React state. Avoid a router framework, global state framework, component framework, and ORM until demonstrated complexity requires one.
- Represent primary navigation state—scope, search, filters, sort, bookmark detail, and saved-view selection—in the browser URL so refresh/back/forward behavior is predictable.

### Persistence and Consistency

- Apply ordered SQL migrations at startup before accepting traffic. Enable foreign keys, WAL, a busy timeout, and explicit transactions.
- Enforce duplicate addresses and normalized tag/saved-view names with database unique constraints, not application pre-checks alone.
- Store user-facing values alongside normalized comparison/search values. Normalize Unicode search/name keys in application code because SQLite's built-in case-insensitive collation is ASCII-limited.
- Use transactional out-of-band metadata updates guarded by address revision and per-field provenance so stale jobs and late results are harmless.
- Materialize bulk selections into expiring selection-set tables when selection occurs. A bulk action consumes that stable snapshot in one transaction, preventing later metadata changes or pagination from altering the affected set.

### Search

- Tokenize and parse the approved grammar with a hand-written, shared recursive-descent parser. It produces a typed AST or a position-aware validation error; raw user search text is never passed to SQLite search syntax.
- Store normalized title, address, description, and plain-note text in a contentful FTS5 trigram table. Use bound FTS phrase queries for substrings of at least three characters and a bounded `instr` scan for one- and two-character atoms.
- Resolve ordinary terms/phrases and exact tag atoms as bookmark-ID sets, compose `AND` with intersection and `OR` with union, then apply scope, multi-tag, favorite/read, sorting, and pagination predicates.
- Keep tags relational rather than concatenating them into an FTS field, ensuring exact tag expressions and quoted phrases cannot match across tag boundaries.
- Verify FTS5/trigram support at startup and in migration tests; the selected SQLite build must fail fast with a clear diagnostic if unavailable.

### Metadata Retrieval and Icon Safety

- Save immediately with a readable address-derived title and `pending` metadata status, then enrich asynchronously. A preview request begins automatically when a valid address is entered, but saving never waits for it.
- Fetch static HTML only; never execute destination JavaScript. Validate and pin all resolved A/AAAA addresses, revalidate every redirect and icon URL, deny non-public/reserved destinations, and use manual redirects, fixed time/byte limits, allowed content types, and bounded concurrency.
- Parse native HTML title/description/icon semantics first and Open Graph text as fallback. Resolve relative URLs against the final document URL and its first valid base URL.
- Fetch icons server-side through the same safety policy, reject active/vector or spoofed content, decode and re-encode a bounded raster image as PNG, and serve it from the app origin.
- Store metadata request revision plus title/description provenance (`fallback`, `retrieved`, or `user`). Apply results only when the address revision still matches and never replace a `user` field without explicit acceptance.

### Notes, Accessibility, and Security

- Store canonical Markdown, derive plain visible text for search, and render only the approved element set. Raw HTML, images, embedded media, unsafe link schemes, and active content remain disabled.
- Build capture, search, filter, selection, dialogs, status feedback, and note controls from semantic HTML with visible focus, labeled state, live announcements where appropriate, and full keyboard operation.
- Use same-origin APIs without production CORS, validate all request/response schemas, require JSON for mutations, check request origin, and apply CSP, frame, MIME-sniffing, and referrer protections.
- Treat the no-auth deployment as suitable only for a trusted owner-controlled network; public multi-user exposure remains outside the approved scope.

### Verification Strategy

- Unit-test URL/name normalization, parser grammar and errors, AST evaluation, note extraction, metadata precedence, IP classification, fallbacks, and provenance transitions.
- Integration-test the real SQLite schema and transactions through Fastify injection, including duplicate races, scopes, filters, saved views, FTS integrity, selection snapshots, rollbacks, and archive/read-later restoration.
- Test metadata against injected DNS and HTTP fixtures covering private-address denial, DNS rebinding, redirects, timeouts, size/type limits, malformed pages, unsafe icons, and out-of-order jobs.
- Component-test accessible names/roles, keyboard paths, dialogs, progress, invalid syntax, and selection clearing.
- Run Playwright against the built app for all seven approved user stories at phone and desktop widths; pair Axe scans with manual keyboard/focus checks.
- Seed 10,000 bookmarks for p95 search measurement and verify a 1,000-row tag-changing bulk action completes within the approved limit and affects no out-of-snapshot row.

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
│   └── search-grammar.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # Created only after plan approval
```

### Source Code (repository root)

```text
src/
├── client/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── bookmarks/
│   │   ├── capture/
│   │   ├── search/
│   │   ├── selection/
│   │   └── saved-views/
│   ├── lib/
│   └── styles/
├── server/
│   ├── app.ts
│   ├── index.ts
│   ├── db/
│   ├── repositories/
│   ├── routes/
│   └── services/
│       ├── metadata/
│       ├── notes/
│       ├── search/
│       └── selection/
└── shared/
    ├── contracts/
    ├── search/
    └── types/

migrations/
public/
tests/
├── unit/
├── contract/
├── integration/
├── performance/
└── fixtures/
e2e/
data/                           # Runtime database; gitignored
```

**Structure Decision**: Use one package with client, server, and shared modules. This keeps deployment to one process and one database while preserving testable browser/server boundaries. Direct SQL lives behind repositories; workflow logic lives in services; HTTP and rendering layers remain thin.
