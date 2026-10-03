# Implementation Plan: Bookmark Management

**Branch**: `001-bookmark-management` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-management/spec.md`

## Summary

Build a responsive, account-based bookmark manager as one TypeScript web application. Users paste a URL; a server-only, SSRF-resistant metadata service proposes the page title, description, and a locally cached safe icon. The application stores private per-user bookmarks, Markdown notes, tags, read-later and archive state in SQLite, exposes authenticated JSON route contracts, and uses a custom query parser plus SQLite FTS5 for precise search. Bulk operations are transactional and ownership-scoped. The first release runs as one Node process on port 4000 and requires no external database; email delivery for account recovery remains a replaceable environment-configured service.

## Technical Context

**Language/Version**: TypeScript 7.x on Node.js 24 LTS

**Primary Dependencies**: Next.js 16.x, React 19.x, Better Auth 1.x, Drizzle ORM 0.45.x, `better-sqlite3` 13.x, Zod 4.x, Cheerio 1.x, `react-markdown` 10.x, `remark-gfm`, `rehype-sanitize`, Sharp 0.34.x

**Storage**: SQLite with WAL mode, foreign keys enabled, checked-in Drizzle migrations, FTS5 search index, and application-managed content-addressed PNG icon files

**Testing**: Vitest 5.x, React Testing Library 16.x, Playwright 1.61.0, `@axe-core/playwright`, real temporary SQLite databases for integration tests

**Target Platform**: Linux-hosted Node.js server and modern desktop/mobile browsers; HTTP server binds `0.0.0.0:4000`

**Project Type**: Full-stack responsive web application, deployed as one Node.js process

**Performance Goals**: 95% of list/search/filter/sort interactions usable within 2 seconds for a 10,000-bookmark collection; known bookmark found and opened within 10 seconds; bulk update of 100 bookmarks within 30 seconds

**Constraints**: Private per-user data; metadata fetching must resist SSRF and DNS rebinding; note rendering must not execute authored content; duplicate detection includes archived bookmarks; permanent deletion is confirmed and irreversible; authenticated pages and APIs are not publicly cached; no external database required for the initial deployment

**Scale/Scope**: Individual accounts, up to 10,000 bookmarks per user, 100 items per bulk request, one application instance for the initial release; import/export, sharing, folders, browser extensions, and full page previews remain outside this release

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The constitution file is still an unratified placeholder and defines no enforceable project-specific principles. The repository-level SDD rules therefore govern this plan:

- The approved specification remains the source of truth; this plan adds implementation choices without changing product behavior.
- No application code or task breakdown is produced during the planning phase.
- Research resolves all technical choices; no unresolved technical markers remain.
- Data, interfaces, validation, security boundaries, and end-to-end verification are documented before task generation.
- The planned server and harness configuration use `0.0.0.0:4000` and the required readiness marker.

**Post-design re-check**: Passed. The data model, contracts, and quickstart trace to the approved requirements. No constitution violation or unjustified complexity was introduced.

## Architecture and Design

### Application boundaries

The application is a modular monolith:

1. Next.js App Router renders authenticated page shells and public authentication pages.
2. Small client components own transient interaction state such as selection, dialogs, search input, note preview, and optimistic feedback.
3. Route Handlers expose the versioned JSON contract in `contracts/openapi.yaml`; they validate input, verify session/CSRF, and delegate to domain services.
4. Domain services implement bookmark rules, transaction boundaries, metadata retrieval, search compilation, and ownership checks.
5. Repositories are the only layer that issues database queries. Every bookmark/tag query requires an authenticated user ID.
6. Better Auth owns account, session, verification, and password-reset records. An `EmailSender` boundary provides production mail and deterministic local/test capture.

### Persistence and consistency

- SQLite is used for the initial single-instance deployment. WAL mode, foreign keys, a busy timeout, short write transactions, and checked-in migrations are mandatory.
- Uniqueness on `(user_id, normalized_url)` prevents duplicate races across active and archived bookmarks. Uniqueness on `(user_id, normalized_name)` prevents duplicate tags.
- Bookmark, tag-link, and search-index changes commit in the same transaction.
- Bulk requests contain explicit IDs and are capped at 100. Known item-level failures can coexist with successful updates; unexpected storage failures roll back the entire operation.
- The repository boundary keeps SQLite-specific details out of the UI and route layers. Moving to PostgreSQL becomes a planned migration if multiple app instances, network storage, or sustained concurrent writes are required.

### Search

- A dedicated lexer/parser implements the approved grammar rather than forwarding raw input to FTS5.
- The parser returns a typed syntax tree or a position-aware correction message. Limits are 1,000 characters, 100 tokens, and 10 levels of nesting.
- Adjacent operands mean `AND`; precedence is `NOT`, `AND`, then `OR`; parentheses override precedence; `tag:` accepts a term or quoted phrase.
- Text leaves compile to safely quoted FTS5 predicates; tag leaves compile to owner-scoped relational predicates. Unary `NOT` is evaluated as exclusion from the current user/view candidate set.
- Search always applies active, unread, or archived view boundaries before stable sort and cursor pagination. Raw query fragments never enter SQL.

### Metadata and icon retrieval

- Only the authenticated server performs retrieval. The service accepts HTTP(S), rejects credentials and non-public destinations, resolves all A/AAAA answers, and pins the connection to a validated public address while preserving hostname verification.
- Redirects are followed manually and revalidated at every hop. Fetching is bounded to five redirects, five seconds total, two MiB of decompressed HTML, controlled headers, and per-user/global rate and concurrency limits.
- Static HTML is parsed without executing scripts. Metadata precedence is Open Graph title/description followed by standard title/description, with a deterministic hostname/path fallback title.
- Retrieved values are proposals. User-edited title/description flags prevent later retrieval from overwriting user text.
- Icons go through the same network checks, are limited to 256 KiB and 512×512, decoded and re-encoded as a static 64×64 PNG, stored under an application-generated key, and served from the same origin. SVG and undecodable/active formats are rejected in favor of a generic domain icon.

### Authentication and browser security

- Better Auth provides email/password accounts, opaque database sessions, email verification, and password-reset lifecycle through its Drizzle adapter. Password hashing is configured for Argon2id through the library's supported password hooks.
- Recovery email is sent through an `EmailSender` interface; production uses configured SMTP/provider credentials, while local/test mode captures messages without exposing a production inbox route.
- Cookies are HTTP-only and SameSite=Lax; production additionally uses Secure `__Host-` cookies and HSTS. Sessions rotate on authentication changes and are revoked on successful password reset.
- Mutating routes require a session-bound CSRF token plus same-origin validation. Authorization is rechecked in the data-access predicate for every single and bulk operation.
- Authenticated HTML/API responses use private/no-store caching where appropriate. Content Security Policy, `nosniff`, frame denial, safe external-link attributes, and no-referrer behavior reduce browser-side exposure.

### Rich notes and validation limits

- Notes are stored as Markdown source and rendered through an AST pipeline. Raw HTML is skipped, output is sanitized with an explicit allowlist, and links are limited to HTTP(S) with safe new-tab attributes.
- Search indexes a plain-text projection of the parsed note, never generated HTML.
- Shared validation limits: URL 4,096 characters; title 500; page description 2,000; note 50,000; tag name 64; at most 50 tags per bookmark; bulk action 100 bookmarks; search query 1,000 characters.

### Observability and operations

- Structured server logs record request IDs, operation names, durations, result classes, and aggregate counts without URLs, note contents, credentials, session IDs, or reset tokens.
- Metadata failures are categorized without logging sensitive target components beyond a safely reduced hostname when appropriate.
- Startup applies no destructive schema changes implicitly. A separate migration command runs before the production server starts.
- The SQLite database and icon store are persistent assets and must be backed up together; restore validation is included in operational documentation.

### Requirement traceability

| Approved requirements | Planned components | Primary validation |
|---|---|---|
| FR-001–FR-002 | Better Auth, email boundary, session/CSRF policy, owner-scoped repositories | Auth/recovery and two-account isolation tests |
| FR-003–FR-012 | URL normalizer, guarded metadata/icon service, bookmark service, uniqueness constraint | Capture, fallback, edit-preservation, duplicate, persistence, and external-open scenarios |
| FR-013 | Tag tables and transactional tag service | Normalization, uniqueness, create/edit, filter, and bulk-tag tests |
| FR-014–FR-016 | Markdown note service, allowlisted renderer, plain-text search projection | Formatting persistence, note-only search, and hostile-content tests |
| FR-017–FR-018 | Reading-state model and unread view | All reading transitions, archive interaction, and persistence tests |
| FR-019–FR-024 | Search parser/compiler, FTS5 document, filters, stable cursor sorts | Grammar contract, malformed-query, view-boundary, scale, and timing tests |
| FR-025–FR-030 | Explicit selection, bulk service, archive transitions, confirmed deletion contract | 100-item actions, mixed/stale IDs, rollback, restore, cancel, and irreversible delete tests |
| FR-031–FR-033 | Page state model, validation/problem responses, retryable operation feedback | Empty/loading/error UI, injected failures, and no-false-success tests |

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── search-query.md
└── tasks.md                 # created only by speckit-tasks after plan approval
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (bookmarks)/
│   │   ├── bookmarks/
│   │   ├── unread/
│   │   └── archive/
│   ├── api/
│   │   ├── auth/[...all]/
│   │   ├── bookmarks/
│   │   ├── metadata/
│   │   └── tags/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── bookmarks/
│   ├── forms/
│   ├── layout/
│   └── ui/
├── features/
│   └── bookmarks/
│       ├── bookmark-service.ts
│       ├── bulk-service.ts
│       ├── metadata-service.ts
│       ├── note-service.ts
│       ├── search-parser.ts
│       ├── search-service.ts
│       ├── url-normalizer.ts
│       └── validation.ts
├── lib/
│   ├── auth/
│   ├── db/
│   │   ├── migrations/
│   │   ├── repositories/
│   │   └── schema.ts
│   ├── email/
│   ├── http/
│   ├── observability/
│   └── security/
└── styles/

public/
└── icons/

tests/
├── unit/
├── component/
├── integration/
├── contract/
├── e2e/
└── fixtures/
    └── metadata-sites/

scripts/
├── migrate.ts
├── seed-review.ts
└── verify-backup.ts
```

**Structure Decision**: Use a feature-oriented modular monolith. UI routes and components remain separate from bookmark domain services; persistence, authentication, email, outbound HTTP, and security policy are explicit infrastructure boundaries. This is the smallest deployment shape that still isolates the high-risk metadata-fetching and authentication concerns for testing or later extraction.

## Design Artifacts

- [Research decisions](research.md)
- [Data model and state transitions](data-model.md)
- [HTTP interface contract](contracts/openapi.yaml)
- [Search language contract](contracts/search-query.md)
- [End-to-end validation guide](quickstart.md)

## Complexity Tracking

No constitution violations require justification. The custom search parser and guarded metadata client are necessary to implement explicit approved behavior and its security boundary; both remain isolated modules with focused tests.
