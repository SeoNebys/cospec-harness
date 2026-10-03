# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a single-user, local-first web application that captures, organizes, searches, preserves, imports, and exports bookmarks. A React single-page interface communicates with a Fastify JSON API. SQLite holds relational data, a durable job queue, and FTS5 indexes; large media, saved HTML, and original PDFs live in a content-addressed file store. A separately supervised capture worker retrieves public resources through an SSRF-resistant gateway, renders HTML in an isolated browser, publishes sanitized static copies atomically, and preserves PDFs byte-for-byte. The application is one deployable Node.js service with no external database or queue.

## Technical Context

**Language/Version**: Node.js 24 LTS with TypeScript 5.9; browser code targets current Chromium, Firefox, and Safari

**Primary Dependencies**: React 19.3, Vite 8.3, Fastify 5.12, TypeBox JSON schemas, better-sqlite3 13, Playwright 1.61.0, pinned Monolith page bundler, parse5 streaming HTML parser, Markdown renderer plus DOMPurify/JSDOM sanitization, PDF.js viewer

**Storage**: SQLite in WAL mode for structured data, jobs, and FTS5; content-addressed files under `/data/blobs` for page copies, PDFs, icons, and preview images; atomic staging under `/data/tmp`

**Testing**: Vitest 5 for unit, component, repository, API, parser, and worker tests; Fastify injection for API integration; Playwright 1.61.0 for browser and offline-copy end-to-end tests; deterministic local capture fixtures

**Target Platform**: Debian-based Linux container, HTTP on `0.0.0.0:4000`; responsive desktop-oriented web UI usable in modern browsers

**Project Type**: Full-stack web application in one npm workspace repository, with a web client, API server, reusable domain packages, and a supervised capture worker

**Performance Goals**: Visible collection actions within 1 second at 10,000 bookmarks; known-item discovery within 10 seconds; 500-item bulk actions within 5 seconds; capture status visible within 2 seconds; metadata proposal within 5 seconds for supported public pages; 10,000-item import with 99.9% title/address retention

**Constraints**: Single-user/no built-in account system; saved copies work without the original resource; original PDFs remain byte-identical; capture cannot access private/reserved networks; snapshots cannot execute active content; one immutable current copy per bookmark; browser interchange is lossy and must disclose losses; no external service dependencies; review runtime must use port 4000

**Scale/Scope**: One user, 10,000+ bookmarks, imports up to 10,000 supported entries per acceptance run, bulk operations up to 500 items, capture concurrency 1 by default and configurable to 2, local persistent volume sized by configurable capture quotas

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The repository constitution is still an unratified placeholder and defines no enforceable technical principles. The project-level SDD rules are therefore the active governance constraints:

- **Approved specification before planning**: PASS — the client approved `spec.md` before this plan was created.
- **Plan before tasks or implementation**: PASS — this phase creates design artifacts only; no production code or task list is created.
- **Specification remains the source of truth**: PASS — every architectural component traces to approved requirements, and no additional product feature is introduced.
- **Review gate preserved**: PASS — planning stops for client review before task generation.
- **Testability**: PASS — contracts, state transitions, and end-to-end validation scenarios are defined before implementation.

### Post-Design Re-check

PASS. Phase 1 introduces no governance violations. The API, worker, database, and blob boundaries exist to satisfy independent approved requirements: interactive use, durable search/state, asynchronous preservation, and safe immutable retained content. No separate deployable service or external infrastructure was added.

## Architectural Design

### Runtime Boundaries

1. **Web client** renders collection, detail, editor, read-later, archive, saved-view, import/export, preference, and capture-status experiences. It never receives raw filesystem paths or injects captured markup into the application DOM.
2. **Fastify API** validates all requests and responses, owns transactions, compiles search ASTs to parameterized queries, serves the built client, and exposes manifest-authorized retained content.
3. **Capture supervisor/worker** runs as a child process with no application session or user browser credentials. It leases durable jobs, uses bounded concurrency, and publishes completed copies only after validation.
4. **SQLite** is the transaction boundary for bookmark state, tags, FTS rows, saved views, preferences, imports, capture attempts, blob references, and jobs.
5. **Blob store** holds immutable content by SHA-256 digest. Staged files are hashed, length-checked, fsynced, and atomically renamed before database publication.

The production bootstrap serves the client and API and supervises the worker. `npm start` remains a single foreground command; the server listens on `HOST=0.0.0.0` and `PORT=4000`.

### Capture Pipeline

1. Bookmark creation and a pending capture attempt/outbox job commit in one transaction; the API returns immediately.
2. A worker leases the job. Expired leases are reclaimable after restart and attempt IDs provide idempotency.
3. The fetch gateway accepts only HTTP/HTTPS on allowed ports, resolves all A/AAAA answers, blocks non-public destinations, pins an allowed address for the connection, and manually validates every redirect and subresource. Direct worker egress is denied where the deployment environment supports network policy.
4. The main response is streamed with size/time limits and classified conservatively from declared type and content validation.
5. A valid PDF is hashed and structurally checked, then stored unchanged. HTML is rendered in a fresh credential-free Chromium context with service workers, WebSockets, downloads, popups, and unmediated networking disabled.
6. Rendered HTML is converted to a static standalone representation with scripts, forms, frames, active SVG, event handlers, refreshes, remote URLs, and unsupported active media removed. CSS and resource URLs are parsed rather than rewritten with regular expressions. A manifest records source/effective URLs, versions, warnings, content hashes, sizes, and capture settings.
7. Validation opens the result with networking disabled and asserts that all references resolve locally and no active behavior or outbound request remains. Only then does a transaction publish the immutable copy and update the attempt.
8. Retry creates a new attempt. Explicit recapture builds a candidate while the current copy remains available and swaps the bookmark pointer only after successful validation and user confirmation.
9. Permanent deletion makes the bookmark and copy inaccessible transactionally, cancels attempts, and runs idempotent orphan-blob garbage collection after commit.

Default safeguards are configurable: 5 redirects, 45-second HTML capture deadline, 500 requests, 15 MiB per asset, 100 MiB page bundle, 250 MiB PDF, and 3 automatic retries only for transient failures.

Saved HTML is displayed only through a dedicated snapshot route inside an iframe with an empty `sandbox` attribute and restrictive CSP, which gives the document an opaque origin even in the single-host review environment. Production deployments map that route to a distinct snapshot hostname through the same application/reverse proxy when available. PDF bytes are displayed through a pinned, network-disabled PDF.js viewer; downloading the retained original is a separate explicit action.

### Search Design

The public search language has its own tokenizer and recursive-descent parser. It produces a bounded AST and reports syntax errors with source offsets and correction hints. Raw user syntax is never forwarded to SQLite FTS.

- Parentheses bind first, then unary `NOT`/`-`, then explicit or implicit `AND`, then `OR`.
- Only uppercase operator words are operators; lowercase forms remain searchable terms.
- Quoted phrases use token-sequence semantics within a single indexed field.
- `#tag` is an exact canonical-tag predicate; tags containing spaces remain selectable through the tag filter UI.
- Independent tag-filter chips use match-all semantics and intersect with the parsed query.
- Active, archive, and unread scopes define the query universe outside the AST.

Text atoms resolve through FTS5 over title, address, description, rendered note text, and individual tag names. Exact tag atoms resolve relationally. The compiler combines parameterized ID sets with `UNION`, `INTERSECT`, and `EXCEPT`, making arbitrary text/tag boolean groups and unary exclusion unambiguous. FTS5 uses the Unicode tokenizer with diacritic folding. Stable keyset pagination adds bookmark ID as the final sort tie-breaker.

### Import, Export, and Rich Content

- Browser import accepts the common Netscape bookmark HTML subset using an inert tolerant streaming parser. It never renders or executes the file. Folder paths become canonical tags; unsupported schemes and active content are skipped. Fatal parse/limit errors write nothing; valid entries, capture attempts, and jobs commit together before capture begins.
- Import limits are 100 MiB raw input, 50,000 entries, and folder depth 128, with bounded strings and attributes. Duplicate URLs never mutate existing bookmarks.
- Export streams a conservative UTF-8 Netscape HTML file as a flat deterministic list. The UI discloses that tags, notes, status, metadata images, saved copies, saved views, and preferences are not portable through this format.
- Rich notes use a documented Markdown subset for headings, lists, emphasis, and links. Stored Markdown is rendered through sanitization; separate plain text feeds search indexing.

### Data Integrity and Recovery

- Migrations are checked-in SQL files and run before the server accepts traffic.
- Foreign keys, WAL, busy timeout, defensive limits, and explicit transactions are enabled.
- Bookmark/tag/note mutations update relational and FTS records in the same transaction. An integrity command can rebuild and compare FTS state.
- A consistent backup is a database snapshot plus referenced blob manifest and blob tree; either alone is incomplete.
- Deletion uses soft inaccessibility only during cleanup coordination, not as a user-visible recycle bin.
- Storage quotas and capture failure codes prevent unbounded or misleading partial artifacts.

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
│   ├── search-grammar.md
│   └── capture-lifecycle.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # created only after plan approval
```

### Source Code (repository root)

```text
apps/
├── server/
│   └── src/
│       ├── api/
│       ├── bootstrap/
│       └── static/
├── web/
│   └── src/
│       ├── components/
│       ├── features/
│       ├── routes/
│       └── styles/
└── worker/
    └── src/
        ├── capture/
        ├── fetch-policy/
        └── jobs/
packages/
├── contracts/
├── domain/
├── persistence/
├── search/
├── blob-store/
├── bookmark-html/
└── test-fixtures/
migrations/
data/                         # runtime only; ignored except documentation
├── app.sqlite
├── blobs/
└── tmp/
tests/
├── contract/
├── integration/
├── security/
├── performance/
└── e2e/
```

**Structure Decision**: Use npm workspaces with three runtime entry points inside one repository and one deployable container. Shared packages isolate pure domain, parser, persistence, and storage logic for independent tests. The worker is a child process rather than a network service, so there is no internal API or additional deployment to operate.

## Verification Strategy

- **Unit**: URL normalization, query lexer/parser/compiler, tag canonicalization, Markdown-to-text, state transitions, limits, import/export escaping, and blob hashing.
- **Contract**: Every OpenAPI response and error shape; search grammar golden cases; capture transition invariants.
- **Integration**: SQLite transactions/rollback, FTS synchronization and rebuild, job leasing/recovery, import summaries, bulk partial outcomes, blob publish/GC, and recapture swap safety.
- **Security**: Blocked IP ranges and redirect/subresource SSRF cases; hostile HTML/CSS/SVG/PDF corpus; zero network during snapshot viewing; CSP/sandbox headers; filesystem traversal; upload/import limits.
- **Performance**: 10,000-bookmark searches and sorts, 500-item bulk actions, 10,000-item import/export, and bounded worker memory/concurrency.
- **End-to-end**: All eight prioritized user stories, including capture with the fixture origin shut down, byte-identical PDF verification, restart persistence, archived-copy retention, and deletion warning.

## Risks and Mitigations

- **Capture fidelity**: Authenticated, highly interactive, canvas/DRM, consent-gated, and continuously changing pages cannot be guaranteed. Surface warnings, retain a usable bookmark, and measure against a versioned representative corpus.
- **Capture security**: SSRF and hostile browser/parser inputs are the highest-risk boundary. Layer pinned-address fetch policy, egress isolation, unprivileged worker limits, sanitization, offline validation, a dedicated snapshot origin, and prompt dependency updates.
- **Disk growth**: Apply per-resource and global configurable quotas, expose usage, deduplicate by digest, and garbage-collect only unreferenced blobs.
- **SQLite limits**: The design intentionally targets one process/user and a local filesystem. Multi-user or horizontally scaled deployment requires a future database/job/storage redesign.
- **Search drift**: Update FTS in the same transaction as source data and test/rebuild integrity after bulk changes.
- **Interchange loss**: The de-facto browser format cannot express the app model. Export conservatively and disclose every omitted field before download.
- **Native/browser reproducibility**: Pin Playwright to the installed browser revision and pin/checksum the Monolith binary; use a Debian image to reduce native dependency variance.

## Complexity Tracking

No constitution violations require justification. The web/API/worker boundaries remain one deployable application and are the minimum separation needed to prevent slow or hostile page capture from blocking interactive bookmark operations.
