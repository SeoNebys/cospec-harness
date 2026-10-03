# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a private, single-user bookmark manager as one deployable Node.js application. A React single-page client will use a versioned REST interface served by the same Express process; SQLite will persist bookmarks, tags, sessions, imports, metadata jobs, and locally cached icons. Automatic metadata enrichment will run only on the server behind strict SSRF controls and will return reviewable proposals rather than mutating user-owned fields. A small parser will turn the approved search language into parameterized predicates. CommonMark notes will render through a restricted component allowlist, and bookmark HTML import/export will preserve browser compatibility while carrying versioned app state for lossless app-to-app round trips.

## Technical Context

**Language/Version**: Node.js 24.x LTS with TypeScript 7.x in strict ESM mode; React 19.3 for the browser client

**Primary Dependencies**: Express 5.2, React Router 8.4 Data Mode, Vite 8.3, Zod 4.6, better-sqlite3 13.x, Undici, ipaddr.js, Sharp, parse5 SAX plus HTML encoding sniffing, react-markdown 10.x, rehype-sanitize, and Pino

**Storage**: One SQLite database on a durable volume, using foreign keys, WAL, short transactions, schema migrations, and content-addressed icon BLOBs; no external database or metadata service

**Testing**: Vitest 5, React Testing Library and user-event, HTTP integration tests against the assembled Express app, fast-check property tests, Playwright 1.61.0 pinned to the installed browser revision, and axe accessibility checks

**Target Platform**: Linux-hosted responsive web application, served on `0.0.0.0:4000`; modern desktop and mobile browsers

**Project Type**: Full-stack web application with a React client, same-origin REST API, background enrichment worker, and one deployable server process

**Performance Goals**: Search/filter/sort/view changes over 10,000 bookmarks in under 2 seconds; bulk actions on 1,000 bookmarks in under 5 seconds; 10,000-bookmark import in under 60 seconds; representative metadata proposals within 5 seconds

**Constraints**: Private single-owner access; exact-address uniqueness across active and archived records; no user input passed directly to SQL or SQLite search syntax; enrichment may contact only validated public HTTP(S) destinations and declared icons; no page JavaScript execution; user edits never overwritten without approval; browser-compatible HTML import/export; keyboard-complete primary journeys

**Scale/Scope**: One owner, one application instance, 10,000+ bookmarks, 1,000-item bulk operations, 10,000-item import files, six primary user journeys, and no horizontal write scaling requirement

## Constitution Check

*GATE: Passed before Phase 0 research; re-checked after Phase 1 design.*

The repository constitution is still an unratified placeholder and contains no enforceable project principles or technical restrictions. No constitution violation exists. The repository's SDD policy is independently binding: the specification is approved, this plan must be reviewed before task generation, and implementation remains blocked until the plan gate is approved.

Post-design re-check: the design artifacts stay within the approved specification, introduce no multi-user or saved-search scope, and preserve the privacy, portability, accessibility, and performance outcomes. Gate remains passed.

## Architecture

### Runtime boundaries

1. **Browser client**: React routes for login, active library, unread view, archive, bookmark editing, import preview, and search help. URL parameters retain collection, query, tag, sort, and cursor state. Selection is client state tied to a query fingerprint and is cleared when its result scope changes.
2. **Application API**: Express validates all inputs and outputs with shared Zod schemas, enforces owner sessions and mutation CSRF checks, applies business rules, and serves the built client and locally cached icons.
3. **Persistence layer**: Reviewed prepared SQL against SQLite. Transactions cover bookmark-plus-tag writes, bulk operations, and import confirmation. No network or file work occurs inside a transaction.
4. **Metadata boundary**: A concurrency-limited worker and preview service fetch public pages with pinned validated DNS results, manually revalidate redirects, parse inert bounded HTML, derive proposals, normalize icons, and never access private network addresses.
5. **Import/export boundary**: Streaming bookmark HTML parsing writes a staged preview; confirmation rechecks duplicates transactionally. Export streams escaped HTML with standard browser fields and a versioned app extension.

### Security and privacy decisions

- One environment-provisioned owner password hash unlocks opaque, database-backed sessions. Cookies are `HttpOnly` and `SameSite=Strict`; production HTTPS adds `Secure`, while review HTTP uses an explicit non-production override.
- Mutations require an origin/fetch-metadata check and a session-bound CSRF token. Login is rate-limited and password verification uses Node's asynchronous `scrypt` with parameters stored in the hash envelope.
- Content Security Policy, `Referrer-Policy: no-referrer`, MIME nosniffing, frame denial, and restrictive cache rules are applied centrally.
- Metadata requests allow only absolute HTTP(S), reject embedded credentials and nonstandard ports for retrieval, resolve all A/AAAA answers, reject any non-public range, pin a validated address to the socket, and repeat validation on every redirect. Bookmarks that cannot be safely enriched remain manually saveable.
- HTML pages, imported bookmark files, and note content are parsed inertly. Imported HTML is never rendered. Notes disallow raw HTML and images, render only approved CommonMark nodes, and restrict links to safe protocols.
- Icons are fetched through the same SSRF boundary, type- and signature-checked, size-limited, decoded, stripped, re-encoded, deduplicated by hash, and served same-origin. Remote icon hotlinking is prohibited.
- Full URLs, notes, descriptions, and imported content are excluded from logs. Logs retain only request IDs, redacted host-level diagnostics, counts, durations, and error categories.

### Search strategy

The query contract is defined in `contracts/search-query.ebnf`. A handwritten lexer and recursive-descent parser returns either an AST with source spans or a position-specific error. Operators are uppercase standalone tokens; precedence is `NOT`, implicit/explicit `AND`, then `OR`.

The server compiles that AST into parameterized SQLite predicates. Plain terms and quoted phrases use case-insensitive substring checks over precomputed NFKC-folded title, URL, description, and rendered-note text, plus an `EXISTS` check over normalized tag names. `tag:` leaves use exact normalized tag identity. Collection scope is always applied outside the user AST. Query length, token count, and nesting are bounded. A seeded 10,000-row benchmark gates this approach; SQLite FTS5 trigram indexing is the documented fallback only if the approved two-second outcome is not met without changing search semantics.

### Metadata workflow

- Pasting a valid URL starts a debounced, cancellable preview. Request IDs and per-field dirty flags ensure stale responses cannot overwrite typing.
- Page metadata priority is Open Graph title/description, then Twitter equivalents, then HTML title/description, with the URL as title fallback only at display time.
- A five-second end-to-end budget, bounded headers/body, supported HTML content types, manual redirect limit, and no retries keep previews predictable.
- Favicons come from validated `rel=icon` candidates, then same-origin `/favicon.ico`; Open Graph images are not treated as icons.
- Initial previews return proposed text plus an opaque staged icon token. Explicit refresh returns a field-level diff. Saving applies only values accepted by the user.
- Generic imports commit immediately, then durable jobs enrich only missing descriptions/icons with global and per-host concurrency limits. Existing bookmarks are never periodically refreshed.

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
│   ├── search-query.ebnf
│   └── bookmark-html.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # created only after plan approval
```

### Source Code (repository root)

```text
client/
├── index.html
└── src/
    ├── app/                 # router, providers, shell, error boundaries
    ├── routes/              # login, library, unread, archive, import
    ├── features/
    │   ├── bookmarks/
    │   ├── search/
    │   ├── selection/
    │   ├── import-export/
    │   └── auth/
    ├── components/          # reusable accessible UI primitives
    ├── services/            # typed same-origin API client
    └── styles/

server/
└── src/
    ├── index.ts             # configuration, startup, 0.0.0.0:4000
    ├── app.ts               # Express assembly and static client serving
    ├── config/
    ├── auth/
    ├── bookmarks/
    ├── search/
    ├── metadata/
    ├── import-export/
    ├── icons/
    ├── db/
    └── observability/

shared/
└── src/                     # Zod contracts, DTOs, enums, query AST types

migrations/                  # ordered, append-only SQLite migrations
scripts/                     # password hashing, migration, seed/perf helpers
tests/
├── unit/
├── integration/
├── contract/
├── e2e/
├── performance/
└── fixtures/
    ├── bookmark-html/
    └── metadata-pages/

data/                        # runtime DB only; ignored by version control
package.json
package-lock.json
tsconfig.json
vite.config.ts
vitest.config.ts
playwright.config.ts
```

**Structure Decision**: Use one npm project with three TypeScript source roots (`client`, `server`, `shared`) and one lockfile. The production build emits a static client and compiled server; `npm start` launches the prepared Express server, which serves both from one origin. This keeps deployment and private-session handling simple while maintaining clear browser/server/security boundaries.

## Verification Strategy

- **Unit**: URL/address rules, Unicode normalization, query lexer/parser/precedence/errors, Markdown node policy, metadata precedence, IP classification, bookmark HTML escaping and decoding, state transitions, and bulk action reducers.
- **Property**: Search parse/print invariants, bounded-parser behavior, HTML escaping, random tag normalization, and export-to-import round trips.
- **Integration**: Real temporary SQLite databases, migrations, unique constraints, transactions, query compilation, session/CSRF checks, import staging and expiry, job recovery, and HTTP contracts.
- **Hostile-network integration**: Controlled HTTP/DNS fixtures for private and mixed DNS answers, rebinding, redirects, timeouts, compression/body limits, malformed HTML, MIME mismatches, and oversized icons; rejected targets must open no unsafe socket.
- **Component/accessibility**: Keyboard interactions, focus restoration, dialogs, selection counts, formatted note display, error messaging, and automated axe checks.
- **End-to-end**: Every independent scenario in the approved specification, using Chromium desktop and mobile viewports, reload persistence, app-export-to-empty-app import equality, and `data-harness-ready="true"` only after the valid page state has loaded.
- **Performance/durability**: Seeded 10,000-bookmark search and import data, 1,000-selection bulk runs, 100 reopen cycles, database integrity checks, and measured thresholds matching SC-002 and SC-004 through SC-008.

## Complexity Tracking

No constitution violations or exception-worthy architecture were introduced. The client/server split is required by arbitrary-site metadata retrieval and private persistence, while the single process and single SQLite database are the simplest deployment that satisfies those boundaries.
