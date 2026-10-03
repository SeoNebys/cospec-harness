# Implementation Plan: Personal Bookmark Manager

**Branch**: `[001-bookmark-manager]` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

Build a single-user bookmark web application that supports low-effort URL capture, safe automatic page metadata retrieval, durable local storage, advanced Boolean/tag search, consistent tag suggestions, independent favorite and unread states, and accessible bookmark management. Use one strict TypeScript codebase: a React client built by Vite and an Express server that exposes a same-origin REST API, serves the production client, and persists data in SQLite. A hardened server-side fetcher retrieves page metadata and cached icons; a dependency-free recursive-descent parser converts the documented search grammar into a validated AST and parameterized SQLite predicates.

## Technical Context

**Language/Version**: Node.js 24.21.0 LTS; TypeScript 7.0.2 in strict ESM mode

**Primary Dependencies**: React 19.3.0, React DOM 19.3.0, Express 5.2.1, Vite 8.3.0, better-sqlite3 13.0.3, Cheerio 1.2.0, Zod 4.6.5

**Storage**: One SQLite database per installation, accessed through better-sqlite3; checked-in SQL migrations, foreign keys enabled, WAL journal mode, normalized uniqueness constraints, and application-maintained Unicode-normalized search columns

**Testing**: Vitest 5.0.1 with jsdom and Testing Library for unit/component tests; Supertest 7.2.2 for API integration tests; Playwright 1.61.0 pinned to the supplied browser revision for end-to-end tests; axe-core plus explicit keyboard-only checks for accessibility

**Target Platform**: Linux-hosted web server with current evergreen desktop/mobile browsers; production server listens on `0.0.0.0:4000`

**Project Type**: Single-package full-stack web application with one deployable server process

**Performance Goals**: With 5,000 bookmarks, collection and valid search/filter results are usable within 2 seconds for at least 95% of attempts; internal database-search test budget targets 250 ms on the project test environment; first bookmark can be saved from a URL in under 30 seconds

**Constraints**: Single user and single installation; same-origin API; no authentication or sync; existing saved data remains manageable without network access; all remote retrieval is server-side and SSRF-hardened; metadata failures are non-blocking except policy-rejected destinations; user edits always win over late metadata; opening a bookmark never changes unread status; all core flows are keyboard accessible

**Scale/Scope**: One user, one SQLite file, up to 5,000 bookmarks with multiple tags; one primary collection screen plus create/edit and confirmation dialogs; no folders, sharing, import/export, extension, or multi-device synchronization

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

The repository constitution is an unratified placeholder and defines no enforceable project principles. The repository-level SDD workflow remains authoritative for this feature.

- **Pre-research gate**: PASS — the specification was approved by the client before technical planning began.
- **Scope gate**: PASS — the design implements only approved first-release behavior and preserves the stated exclusions.
- **Security gate**: PASS — arbitrary URL retrieval is treated as an SSRF boundary with per-hop validation, DNS-to-socket pinning, strict resource caps, inert parsing, and app-served cached icons.
- **Simplicity gate**: PASS — one package, process, database, and deployable application; no external search service, ORM, SSR framework, or distributed dependency.
- **Testability gate**: PASS — pure search/parser/normalization units, isolated repository and metadata services, API contracts, deterministic fixtures, and browser-level acceptance checks are all identified.
- **Post-design re-check**: PASS — the data model and contracts retain the single-process boundary, parameterize all data access, and add no unapproved user-facing scope.

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
└── tasks.md                 # Created only after plan approval
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
│   │   ├── search/
│   │   └── tags/
│   ├── services/
│   ├── styles/
│   └── main.tsx
├── server/
│   ├── api/
│   ├── db/
│   │   └── migrations/
│   ├── metadata/
│   ├── repositories/
│   ├── search/
│   ├── app.ts
│   └── server.ts
└── shared/
    ├── contracts/
    ├── normalization/
    └── schemas/
tests/
├── unit/
├── integration/
├── e2e/
├── fixtures/
└── performance/
var/
└── .gitkeep                 # Runtime database directory; database ignored
.harness/
└── app.json
```

**Structure Decision**: Use one npm package with explicit client, server, and shared boundaries. Vite builds the React client; TypeScript builds the Express server, which serves both `/api/*` and the compiled client from the same origin. This produces one lockfile, one migration path, and one foreground `npm start` command for the required runtime while keeping browser-only and server-only code separated.

## Design Decisions

### Application boundary

- Express owns API routing, validation, static production hosting, error translation, and the `0.0.0.0:4000` listener.
- React owns transient form and collection view state. Search text and filters are mirrored in URL query parameters so opening a bookmark does not lose the current view.
- Zod schemas in `src/shared/schemas` define request/response boundaries and are exercised by contract tests.
- The app shell receives `data-harness-ready="true"` only after initial bookmark/tag data has loaded or a valid empty state is available.

### Persistence and transactions

- SQL migrations create `bookmarks`, `tags`, `bookmark_tags`, and cached icon assets. Repository methods are the only database access path.
- Create/edit operations normalize the destination URL, tags, and search shadow fields in one transaction. The database unique constraint on `normalized_url` is the final duplicate guard, including redirect-resolved addresses.
- Deleting a bookmark cascades tag links and removes orphaned icon assets. Tags may be retained for suggestions only while referenced; an edit/delete transaction removes newly orphaned tags.
- Search scans application-normalized shadow columns and tag relationships. At 5,000 rows this preserves the required substring semantics more reliably than token-based full-text search; FTS is deferred until profiling proves it necessary and equivalence tests pass.

### Search language

- A dependency-free lexer and recursive-descent parser produce typed `Term`, `Phrase`, `Tag`, `Not`, `And`, and `Or` AST nodes with source offsets.
- Parentheses bind first, then unary `NOT`, then explicit/implicit `AND`, then `OR`. Adjacent expressions imply `AND`.
- AST leaves compile only to bound SQLite parameters. Wildcard characters are escaped before substring matching; `#tag` compiles to exact normalized tag identity.
- Invalid syntax is a typed validation result, not a server failure. The original query and error span are returned unchanged.
- Defensive ceilings are 1,000 query characters, 64 nesting levels, and 128 leaf expressions.

### Safe metadata retrieval

- `MetadataFetcher` is the only component allowed to make arbitrary outbound requests. It sends no user/session credentials, follows redirects manually, and accepts only public `http`/`https` pages on ports 80/443.
- Each initial host, redirect target, and favicon target is parsed, DNS-resolved, classified against IANA special ranges, and pinned from validation to the actual socket. Any non-public answer rejects the target.
- HTML retrieval has an 8-second total deadline, 2-second connection/header phase, five-redirect ceiling, 1 MiB decoded-body limit, and HTML-only media policy. It executes no scripts or subresources.
- Metadata precedence is deterministic: HTML title then Open Graph/Twitter fallbacks; standard description then Open Graph/Twitter fallbacks. Strings are normalized, bounded, and returned as plain text.
- One favicon candidate is fetched through the same guardrails, restricted to safe raster/ICO types and 256 KiB decoded bytes, then stored as an app-owned asset. SVG and remote hotlinking are excluded.
- Client requests carry a URL snapshot/request ID and dirty flags. Obsolete responses are ignored and late responses never overwrite a field the user edited.

### Verification strategy

- Unit tests cover normalization, URL policy, metadata extraction, dirty-field races, lexer/parser precedence, error spans, AST compilation, tag suggestions, and reading-state transitions.
- Integration tests use temporary SQLite files and controlled local HTTP fixtures to cover transactions, duplicate races, redirects, metadata fallbacks, content limits, SSRF rejections, icon caching, and every API response shape.
- Search semantic fixtures cover every field, Boolean truth tables, quoted phrases, exact tags, filters, wildcard/injection-shaped input, Unicode, and 5,000-row performance.
- Component and end-to-end tests cover URL-only saving, metadata fallbacks, advanced search, tag combobox behavior, independent favorites/unread status, confirmation, view-state retention, empty/error states, keyboard-only flows, and automated accessibility checks.
