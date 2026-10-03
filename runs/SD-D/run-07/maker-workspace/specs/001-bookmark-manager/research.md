# Research: Bookmark Manager

## Application architecture

**Decision**: Use Node.js 24 LTS, strict TypeScript, Next.js 16.3.x App Router, React 19.3.x, and Tailwind CSS 4.3.x as one self-hosted application.

**Rationale**: One Next.js process supports initial server rendering, progressive form actions, a small JSON metadata boundary, and a responsive React UI without separate frontend/API deployments. Server Components keep initial reads close to storage; client components remain limited to browser interaction state.

**Alternatives considered**: Vite + React + Fastify cleanly separates an API but duplicates routing/build/deployment without a second client. Separate SPA/API deployments add operations without product value. CSS Modules are viable, but Tailwind speeds a UI-heavy build when constrained by a small component/token layer.

**References**: [Node releases](https://nodejs.org/en/about/previous-releases), [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting).

## Persistence

**Decision**: Use `better-sqlite3` with one SQLite file, foreign keys, WAL, a short busy timeout, checked-in migrations, and repository/service boundaries.

**Rationale**: SQLite comfortably handles the target scale and transactional bulk work while matching same-installation persistence. `better-sqlite3` is stable; Node 24's built-in SQLite API remains release-candidate stability. Direct SQL makes FTS5 and savepoint behavior explicit.

**Alternatives considered**: `node:sqlite` would remove a dependency but is not stable in Node 24. PostgreSQL adds unjustified operations for a single installation. ORM-first persistence still requires extensive raw FTS/bulk SQL and obscures critical behavior.

**References**: [SQLite WAL](https://www.sqlite.org/wal.html), [transactions](https://www.sqlite.org/lang_transaction.html), [foreign keys](https://www.sqlite.org/foreignkeys.html), [`better-sqlite3` API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md).

## Search

**Decision**: Maintain an FTS5 shadow table with title, URL, description, note, and flattened tags. Parse the product language with a bounded lexer and recursive-descent parser, then compile its AST to parameterized SQL set operations.

**Rationale**: The grammar requires unary `NOT`, exact tags, fixed precedence, visible interpretation, and position-aware errors. Raw `MATCH` passthrough would expose SQLite syntax and create inconsistent semantics. Set algebra maps `AND` to intersection, `OR` to union, and unary `NOT` to universe-minus-operand.

**Alternatives considered**: Raw FTS5 passthrough violates the product grammar and safe errors. An external search service adds operations and data movement. `LIKE` is weak for phrases, Boolean combinations, and growth.

**Reference**: [SQLite FTS5](https://www.sqlite.org/fts5.html).

## URL identity

**Decision**: Normalize with WHATWG URL semantics; canonicalize scheme/host, remove fragments, elide default ports, and retain scheme, path, trailing slash, and query order/values. Store original and normalized forms with a unique normalized constraint.

**Rationale**: This removes inconsequential differences without merging destinations whose query, scheme, or path can differ meaningfully. Database uniqueness makes duplicate behavior race-safe.

**Alternatives considered**: Removing tracking parameters or sorting queries risks false duplicates. Literal-string identity misses common fragment and canonical-host duplicates.

**Reference**: [WHATWG URL Standard](https://url.spec.whatwg.org/).

## Metadata and icons

**Decision**: Use a server-only adapter built on Undici with a custom connector, Cheerio for bounded static parsing, and `ipaddr.js` plus explicit address policy. Revalidate and pin DNS for every redirect/candidate. Enforce redirect, time, byte, MIME, and concurrency limits. Cache accepted raster icons locally.

**Rationale**: Arbitrary URLs create SSRF and DNS-rebinding exposure. Owning transport ensures connection only to a validated public address while retaining original TLS/Host identity. Local icon serving prevents IP leakage and remote content swaps.

**Alternatives considered**: Browser fetching fails broadly under CORS and weakens policy. `Cheerio.fromURL` owns redirects/transport. A vendor metadata API leaks bookmark destinations and adds cost/availability dependency. SVG icons add active-content complexity.

**References**: [Undici fetch](https://github.com/nodejs/undici/blob/main/docs/docs/api/Fetch.md), [connectors](https://github.com/nodejs/undici/blob/main/docs/docs/api/Connector.md), [Node DNS](https://nodejs.org/api/dns.html#dnspromiseslookuphostname-options), [Cheerio security](https://cheerio.js.org/docs/advanced/security/), [loading](https://cheerio.js.org/docs/basics/loading/).

## Bulk actions

**Decision**: Bulk preview snapshots exact bookmark IDs and count in short-lived records. Confirmation executes the snapshot in an outer transaction with per-item savepoints, records failures, and commits successes plus the final result.

**Rationale**: A snapshot prevents “all matching” drift. Savepoints implement partial success while the outer transaction prevents an unrecorded half-operation after a crash. Status and confirmation key make retries idempotent.

**Alternatives considered**: Re-running the query can change targets after confirmation. All-or-nothing contradicts partial-success behavior. One transaction per item can leave an unreconciled operation after failure.

**References**: [SQLite savepoints](https://www.sqlite.org/lang_savepoint.html), [atomic commit](https://www.sqlite.org/atomiccommit.html).

## Testing

**Decision**: Use Vitest for domain/services, React Testing Library for UI components, temporary real SQLite databases for integration, and Playwright 1.61.0 for end-to-end, keyboard, persistence, and performance scenarios.

**Rationale**: Query compilation, URL identity, SSRF policy, FTS synchronization, bulk snapshots, and keyboard workflows need validation at their natural boundaries. Real SQLite tests cover behavior mocks cannot prove.

**Alternatives considered**: End-to-end-only testing is slow and poor for exhaustive parser/security edges. Database mocks cannot prove FTS, foreign keys, migrations, WAL, or savepoints.

**References**: [Vitest](https://vitest.dev/guide/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), [Playwright](https://playwright.dev/docs/best-practices).
