# Phase 0 Research: Bookmark Manager

## Decision 1: Runtime and application boundary

**Decision**: Use TypeScript on Node.js 24 LTS, with React 19/Vite 7 in the browser and Fastify 5 on the server. Serve the built client and API from one origin.

**Rationale**: The available runtime already provides Node.js 24 and Chromium. Node 24 is an LTS line suitable for a production application. A single language and shared schemas reduce contract drift, while the browser/server split is necessary because public-page retrieval, private-address blocking, and snapshots cannot safely or reliably run in the user's browser. Fastify's schema validation provides a strong HTTP boundary without a large framework.

**Alternatives considered**:

- A browser-only app: rejected because cross-origin restrictions prevent dependable metadata extraction and snapshots, and local browser storage is a poor fit for large images.
- Next.js or another full-stack rendering framework: rejected because server-side page rendering adds complexity without user-facing value for this private application.
- Python server plus JavaScript client: viable, but rejected to keep domain contracts and tooling in one language.

## Decision 2: Structured persistence and asset storage

**Decision**: Use SQLite through `better-sqlite3` and Drizzle migrations for structured records. Store snapshots, favicons, and preview images as controlled files referenced by opaque IDs.

**Rationale**: One installation and one server process align with SQLite's embedded, transactional model. The target of 10,000 bookmarks is tiny relative to SQLite's practical capacity. Keeping large image bytes in files makes streaming, replacement, quotas, and cleanup clearer while SQLite retains authoritative lifecycle metadata.

**Alternatives considered**:

- PostgreSQL: rejected because a separate service is unnecessary for a single-user installation.
- Browser IndexedDB: rejected because capture work is server-side and durable image/file lifecycle is harder to operate and back up coherently.
- Images as SQLite BLOBs: workable at this scale, but rejected because large-row churn and HTTP streaming are simpler with controlled files.

## Decision 3: Snapshot representation

**Decision**: Preserve a full-page WebP visual capture with capture time, source URL, dimensions, and complete/partial/failed status. Cap extreme page height and output size; a capped capture is `partial`.

**Rationale**: The approved requirement is to see what the page looked like when saved. A visual capture is inert, durable, safe to display, and directly fits that wording. Playwright officially supports full-page screenshots and can return image buffers. WebP reduces disk usage while retaining readable page imagery.

**Alternatives considered**:

- Archived HTML/MHTML: rejected for v1 because browser display support is inconsistent and replaying saved active content creates security and fidelity problems.
- Reader-mode text: rejected because it does not preserve what the page looked like and fails on many non-article pages.
- PDF: rejected because pagination changes the original appearance and adds a less convenient viewer path.

## Decision 4: Metadata extraction and job execution

**Decision**: Use the same isolated Playwright navigation for DOM metadata and snapshot capture. Persist jobs in SQLite and run them through an in-process worker with concurrency two and startup recovery.

**Rationale**: Client-rendered pages often expose final metadata only after script execution. One navigation avoids duplicate page loads. Persisted jobs keep create requests fast and recover from process restarts without an external queue.

**Alternatives considered**:

- HTTP fetch plus HTML parser only: faster and lighter but incomplete for client-rendered sites.
- External job broker: operationally disproportionate for one user and one process.
- Synchronous capture in the create request: rejected because slow or hostile destinations would make saving feel unreliable.

## Decision 5: Network safety policy

**Decision**: Accept only HTTP(S) public destinations. Normalize hosts, resolve DNS, reject non-public IPv4/IPv6 ranges, revalidate redirects and browser subrequests, limit redirects/bytes/time/page height, isolate browser contexts, and never attach application cookies or credentials.

**Rationale**: Server-side navigation to user-provided URLs creates SSRF and resource-exhaustion risks even in a personal app. Validation must apply at every hop, not only to the original string. Captured output is served as an inert image rather than active third-party content.

**Alternatives considered**:

- Trust all URLs because the app is single-user: rejected because pages and redirects are not trusted, and the server may have access to private services.
- Domain allowlist: safer but incompatible with a general bookmark manager.

## Decision 6: Search evaluation

**Decision**: Build a bounded tokenizer, recursive-descent parser, typed AST, and parameterized SQLite predicate compiler. Use ordinary indexed relational fields and tag joins; do not adopt a separate search engine for 10,000 records.

**Rationale**: The grammar is intentionally small but has quotes, unary NOT, implicit AND, OR, and parentheses. An AST makes precedence and errors testable. Parameterized SQL protects against injection, supports NOT-only queries, and remains easily fast enough at the approved scale.

**Alternatives considered**:

- Split strings ad hoc: rejected because grouping, quotes, and precedence become ambiguous and fragile.
- SQLite FTS query syntax exposed directly: rejected because its grammar and error behavior would leak into the product contract and complicate exact tags and NOT-only searches.
- Elasticsearch/Meilisearch: rejected as operationally excessive for 10,000 personal records.

## Decision 7: Shared validation contracts

**Decision**: Define TypeBox request/response schemas in a shared workspace and register them with Fastify's official type-provider path. Keep the design-level OpenAPI contract in `contracts/api.yaml` and test runtime schemas against it.

**Rationale**: Fastify recommends JSON Schema for route validation and serialization, and its type providers infer TypeScript types from those schemas. One shared definition gives both the server and client typed payloads while preserving runtime validation.

**Alternatives considered**:

- TypeScript interfaces only: rejected because types disappear at runtime.
- Independently maintained client types and server validators: rejected because they can drift.

## Decision 8: Testing and delivery

**Decision**: Use Vitest for unit/component/integration tests and Playwright 1.61.0 for browser tests, pinned to the installed browser revision. Run deterministic capture tests against a local fixture site explicitly allowed only in test configuration.

**Rationale**: The environment provides Playwright 1.61.0 and Chromium. A local fixture removes internet variability while production defaults continue to reject private destinations. End-to-end tests can exercise the same capture states and UI paths repeatedly.

**Alternatives considered**:

- Live internet pages in automated tests: rejected as flaky and outside application control.
- Mock every capture layer: rejected because it would not verify browser integration or snapshot display.

## Primary references

- Node.js release policy and current lines: https://nodejs.org/en/about/previous-releases
- Fastify validation and serialization: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
- Fastify TypeScript type providers: https://fastify.dev/docs/latest/Reference/Type-Providers/
- Playwright full-page screenshots: https://playwright.dev/docs/screenshots
- SQLite implementation limits: https://sqlite.org/limits.html
