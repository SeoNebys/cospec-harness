# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Status**: Approved on 2026-09-23

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a responsive, single-user bookmark web application as one TypeScript project with a React client and a Fastify server. The server owns durable SQLite data, enforces normalized-URL uniqueness, evaluates the documented search language, and retrieves page metadata through an SSRF-hardened outbound service. Rich notes are stored as validated structured documents rather than arbitrary HTML. Retrieved icons and preview images are copied into bounded local media storage so saved bookmarks do not expose the browser directly to third-party assets.

The implementation will be delivered in prioritized vertical slices matching the approved stories: save with metadata and duplicate routing; search, tags, filters, and sorting; read-later status; editable details and formatted notes; then archive, restore, and confirmed deletion.

## Technical Context

**Language/Version**: TypeScript on Node.js 24.x LTS; browser code compiled as modern JavaScript for current mainstream browsers

**Primary Dependencies**: React 19.3, Vite 8.x, Fastify 5.x, React Router 7.x, TanStack Query 5.x, React Aria Components, Tiptap 3.x StarterKit, Cheerio, Sharp, TypeBox, and `better-sqlite3` 13.x

**Storage**: One SQLite database for bookmark records, tags, preferences, migrations, expiring metadata drafts, and bounded processed raster assets stored as deduplicated BLOBs

**Testing**: Vitest 5.x, React Testing Library, Fastify injection tests, Playwright 1.61.0 pinned to the provided browser binaries, and `@axe-core/playwright`

**Target Platform**: Linux-hosted responsive web application served on `0.0.0.0:4000`; current Chromium, Firefox, and WebKit-class desktop/mobile browsers; review entry point `http://maker:4000/`

**Project Type**: Single-package full-stack web application with client, server, and shared domain modules

**Performance Goals**: User-visible collection operations within 1 second at 1,000 bookmarks; metadata result or actionable failure within 5 seconds; known bookmark discoverable and openable within 10 seconds; stable pagination with at most 100 returned bookmarks per request

**Constraints**: Single-user and no authentication; no cross-device synchronization; 320-pixel minimum viewport; keyboard-complete workflows; no arbitrary HTML execution; strict duplicate prevention across active and archived records; outbound metadata retrieval must reject non-public destinations and revalidate redirects

**Scale/Scope**: One user, approximately 1,000 bookmarks, five primary application views/workflows, one SQLite file, and locally cached icon/preview assets; multi-user operation, cloud sync, imports, exports, and browser extensions are out of scope

## Constitution Check

*GATE: Evaluated before Phase 0 and re-evaluated after Phase 1 design.*

The project constitution is still an unratified template containing placeholders, so it defines no enforceable project-specific gates. The repository-level SDD rules remain binding.

- **Specification gate**: PASS — `spec.md` is approved and the plan does not add product scope beyond it.
- **Planning gate**: PASS — no implementation or task execution occurs in this phase.
- **Traceability**: PASS — routes, entities, state transitions, and validation scenarios trace to FR-001 through FR-036 and SC-001 through SC-009.
- **Security and privacy**: PASS — the design keeps scraped markup out of rendering, validates structured notes, protects outbound fetches from SSRF, and uses same-origin APIs.
- **Simplicity**: PASS — one deployable Node process, one package, one database, and no background queue or external service are required for the approved scale.
- **Testability**: PASS — URL normalization, search parsing, metadata extraction, state transitions, API contracts, responsive flows, and accessibility each have isolated test seams.

**Post-design re-check**: PASS. The Phase 1 artifacts preserve the same boundaries. The HTTP API and transient metadata-draft resource are internal interfaces needed by the client, not new user-facing scope. No gate violation requires a complexity exception.

## Architecture and Delivery Decisions

### Runtime shape

- A single Fastify process serves the compiled React assets and `/api/*` routes on port 4000.
- The browser never connects directly to bookmark destinations for metadata or cached images. The server retrieves and validates those resources, then serves local copies with restrictive response headers.
- The client uses route-based views for active bookmarks, To Read, Archive, create/edit, and bookmark details. Query state remains in the URL where useful; only the approved sort preference persists.
- Shared TypeScript modules contain URL normalization, API types, rich-note schemas, search grammar types, and constants so validation behavior cannot drift between client and server.

### Persistence and consistency

- SQL migrations create strict tables and indexes. Foreign keys are enabled and write sequences use transactions.
- A unique constraint on `bookmarks.normalized_url` is the final duplicate guard across active and archived records. Service-level checks provide the friendly redirect target, while the database handles races.
- Notes are stored as a Tiptap-compatible JSON document plus derived plain text for search. The server validates the node/mark allowlist and regenerates search text; clients cannot submit trusted HTML.
- Icons and previews are decoded with pixel limits, reduced to a static bounded raster, and content-addressed by digest. A metadata preview produces expiring draft references; saving a bookmark atomically attaches those assets. Unreferenced staged assets are cleaned safely.

### Search and collection queries

- A deterministic recursive-descent parser implements the approved grammar: words, quoted phrases, `tag:` conditions, implicit/explicit `AND`, `OR`, precedence, and parentheses.
- Parsed expressions become an abstract syntax tree evaluated against normalized bookmark search documents. At the approved 1,000-item scale, bounded in-process evaluation is simpler and more predictable than coupling product syntax to a database full-text grammar.
- View membership and UI filters are applied before expression evaluation; stable sorting and pagination are applied afterward. Syntax failures return source offsets so the client can preserve and highlight the query.
- Query length, token count, and nesting depth are capped to prevent pathological expressions without affecting ordinary use.

### Metadata retrieval safety

- The metadata service accepts only HTTP(S), resolves every destination and redirect, rejects loopback/private/link-local/multicast/reserved addresses for IPv4 and IPv6, pins a vetted address for the connection, rejects HTTPS-to-HTTP downgrade, and permits at most three redirects.
- Fetches use no ambient credentials or cookies and enforce total timeout, decompressed-byte, content-type, and image-size limits.
- Cheerio parses bounded HTML bytes only; scripts are never executed and scraped HTML is never returned or rendered. Extraction follows a deterministic preference order for standard title, description, icon, and social preview metadata.
- Only verified raster image formats are decoded; Sharp removes animation/metadata and emits a bounded static PNG icon or WebP preview. SVG and other active or unsupported formats fall back to a neutral visual.

### Accessibility and responsive interaction

- Semantic controls, labelled forms, focus restoration, live status announcements, visible focus, and keyboard-operable dialogs/menus are part of each vertical slice.
- Tiptap exposes only the approved formatting commands with labelled, stateful toolbar buttons and equivalent keyboard shortcuts. React Aria Components supplies the tag combobox and confirmation-dialog interaction primitives.
- External bookmark and note links open with isolation protections. A restrictive content security policy blocks inline script, object embedding, framing, and third-party resource loading.
- Automated accessibility scans supplement, but do not replace, keyboard and screen-reader-oriented interaction tests.

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
│   └── search-grammar.ebnf
└── tasks.md                 # Created only after plan approval
```

### Source Code (repository root)

```text
package.json
package-lock.json
tsconfig.json
vite.config.ts
vitest.config.ts
playwright.config.ts
src/
├── client/
│   ├── app/                 # Routing, providers, shell, global error states
│   ├── components/          # Shared accessible UI primitives
│   ├── features/
│   │   ├── bookmarks/       # Lists, details, create/edit, state actions
│   │   ├── metadata/        # Paste-to-preview workflow and draft state
│   │   ├── notes/           # Rich-note editor and read-only renderer
│   │   ├── search/          # Search input, examples, filters, sort controls
│   │   └── tags/            # Tag entry and suggestions
│   ├── lib/                 # API client, query client, focus/status helpers
│   ├── styles/              # Tokens, responsive layout, component styles
│   └── main.tsx
├── server/
│   ├── app.ts               # Fastify composition and static client serving
│   ├── index.ts             # Production entry point; 0.0.0.0:4000
│   ├── config/              # Validated runtime paths and limits
│   ├── db/
│   │   ├── migrations/
│   │   ├── connection.ts
│   │   └── repositories/
│   ├── routes/              # HTTP adapters matching contracts/openapi.yaml
│   ├── services/            # Bookmark, tag, preference, and metadata logic
│   ├── security/            # Origin checks, outbound URL/IP policy, headers
│   └── media/               # Raster processing, draft attachment, asset cleanup
└── shared/
    ├── api/                 # Shared request/response and error schemas
    ├── bookmarks/           # Domain types and state rules
    ├── notes/               # Structured-note schema and plain-text extraction
    ├── search/              # Lexer, parser, AST, evaluator, syntax errors
    └── urls/                # Validation and duplicate normalization
tests/
├── unit/                    # Pure URL, search, note, extraction, and state tests
├── integration/             # SQLite repositories, transactions, routes, media
├── contract/                # OpenAPI response and search grammar conformance
├── e2e/                     # Prioritized user journeys and responsive/a11y checks
└── fixtures/                # Metadata pages/images and seeded bookmark sets
data/                        # Runtime SQLite database; ignored, not source-controlled
```

**Structure Decision**: A single package and process avoid workspace and deployment overhead while preserving explicit client/server/shared boundaries. The server is necessary for safe metadata retrieval and durable uniqueness; a client-only design cannot satisfy those requirements reliably. Tests mirror user-facing contracts and domain boundaries rather than source folders mechanically.

## Verification Strategy

- **Unit**: URL equivalence table; parser precedence and error offsets; expression evaluation; tag normalization; note schema and text extraction; metadata priority rules; public-IP classification; state transitions.
- **Integration**: Real temporary SQLite database and filesystem; unique conflicts and rollback; active/archive duplicate routing; tag cleanup; asset promotion/cleanup; metadata limits and manual redirects through an injected transport; every API response schema.
- **Component**: Metadata progress/manual override race, tag suggestions, query examples/errors, sorting, rich-note toolbar semantics, dialogs, empty/error states, and focus management.
- **End to end**: Each approved independent story, persistence after restart, keyboard-only operation, 320-pixel and desktop layouts, and automated accessibility scans. Test composition injects deterministic metadata fixtures without adding a production bypass.
- **Performance**: Seed 1,000 bookmarks, assert collection interactions return visible results within 1 second, and exercise complex valid searches plus worst-case bounded syntax.
- **Security**: Reject local/private IPv4 and IPv6, alternative address encodings, redirect-to-private, DNS change between validation and connect, oversized/compressed bodies, unsupported media, unsafe note links, cross-origin writes, and stored-script attempts.

## Complexity Tracking

No constitution violations or complexity exceptions are present.
