# Research: Bookmark Manager

## Decision 1: One TypeScript application with React and Fastify

**Decision**: Use React 19 with Vite 7 for the browser interface and Fastify 5 for the HTTP server, built and released as one npm package and one production process.

**Rationale**: The feature needs a responsive interactive library and a trusted server component for persistence and cross-origin page retrieval. A single language and shared validation schemas reduce contract drift, while one production process matches the single-user scope. React's documented single-root client model fits this application, and Fastify provides schema-oriented request handling without requiring a multi-service deployment.

**Alternatives considered**:

- Server-rendered HTML with minimal client scripting: simpler initially, but more cumbersome for metadata status, non-destructive form editing, live search/filtering, and responsive dialog state.
- A full-stack meta-framework: capable, but adds routing and rendering machinery not needed for one application screen and a small HTTP API.
- Separate frontend and backend packages: stronger independent deployment boundaries, but unnecessary for a one-process private app.

**Sources**: [React `createRoot` documentation](https://react.dev/reference/react-dom/client/createRoot), [Fastify v5 reference](https://fastify.dev/docs/v5.0.x/Reference/), [Vite guide](https://vite.dev/guide/)

## Decision 2: SQLite through Node's built-in module

**Decision**: Store bookmarks and tags in file-backed SQLite using `node:sqlite`, prepared statements, explicit transactions, foreign keys, defensive mode, and versioned SQL migrations.

**Rationale**: SQLite gives durable relational storage, uniqueness and referential constraints, indexed retrieval, and straightforward backup for a single-user deployment. Node 24 includes the module without a separate native package. Synchronous operations are acceptable at the specified scale because queries are bounded and local; metadata network work remains asynchronous and outside database transactions.

**Alternatives considered**:

- Browser local storage or IndexedDB: avoids a server datastore but cannot safely support server-side metadata retrieval and makes backup, querying, and consistent validation less straightforward.
- JSON file persistence: minimal dependencies, but transactional edits, many-to-many tags, duplicate checks, and concurrent request safety would need custom machinery.
- PostgreSQL: robust, but introduces an external service and operational burden unsupported by the one-user/10,000-bookmark scope.
- A third-party SQLite binding: mature, but adds native installation and ABI considerations that are avoidable in the provided Node 24 runtime.

**Risk note**: The Node 24 documentation labels `node:sqlite` release-candidate stability. The database layer will remain behind a narrow repository module so it can be replaced if runtime support proves inadequate.

**Source**: [Node.js 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

## Decision 3: Server-side page metadata with explicit SSRF controls

**Decision**: Fetch metadata on the server using Undici with automatic redirects and retries disabled. Accept only HTTP(S), disallow URL credentials, resolve and reject loopback/private/link-local/reserved/multicast addresses for IPv4 and IPv6, connect to an approved resolved address, and repeat validation for every redirect. Limit redirect count to 5, total elapsed time to 8 seconds, body bytes to 1 MiB, and accepted content to HTML/XHTML.

**Rationale**: Browser requests to arbitrary sites are commonly blocked by cross-origin policy. Server-side retrieval solves that but creates an SSRF boundary. Validating both initial and redirected destinations, controlling DNS-to-connection behavior, and applying strict resource bounds addresses the central risks while permitting the public-web behavior required by the specification.

**Alternatives considered**:

- Browser-only metadata retrieval: unreliable because destination servers generally do not grant cross-origin access.
- A third-party preview service: outsources difficult retrieval but adds cost, availability, privacy, and vendor dependency outside the v1 scope.
- Simple hostname denylist: insufficient against alternate IP formats, IPv6, redirects, and DNS rebinding.
- Headless-browser extraction: handles script-rendered pages but is much heavier, expands attack surface, and is not required because the approved spec asks for page-provided metadata rather than generated rendering.

**Source**: [OWASP Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## Decision 4: Deterministic metadata extraction and fallback

**Decision**: Parse the bounded HTML response with Cheerio. Title priority is `og:title`, then the document `<title>`, then a title derived from the final hostname. Description priority is `meta[name="description"]`, then `meta[property="og:description"]`, otherwise blank. Decode entities, collapse whitespace, trim, and enforce the approved 200/500-character limits. Return all values as plain text.

**Rationale**: A deterministic priority order is testable and avoids ambiguous behavior. Plain-text output prevents retrieved markup from becoming executable UI. A domain-derived title guarantees the user can save quickly when metadata is missing.

**Alternatives considered**:

- Generate summaries from page contents: explicitly outside scope and introduces latency, cost, and content-handling concerns.
- Preserve retrieved markup: unnecessary and unsafe.
- Require manual title on failure: contradicts the approved fast-save fallback.

## Decision 5: Server-side query, filter, and sort

**Decision**: Apply text query, one tag filter, favorite filter, and sort in SQLite. Search uses a normalized case-insensitive substring match across title, URL, description, notes, and tag names. Indexed sort/filter columns and tag junction indexes keep the 10,000-item target well within the 1-second visible-update goal. The client debounces query changes by 250 ms and cancels superseded requests.

**Rationale**: One consistent query implementation avoids loading the entire library into browser memory and directly exercises the persistence layer users rely on.

**Alternatives considered**:

- Client-only filtering: viable at 10,000 items, but duplicates query rules and requires transferring the full library on every initial load.
- SQLite full-text search: powerful but unnecessary for substring matching at this scale and introduces synchronization complexity for tag text.

## Decision 6: Layered automated validation

**Decision**: Use unit tests for normalization, metadata parsing, IP classification, reducers, and validation; integration tests with temporary SQLite databases and controlled local HTTP fixtures; contract tests against the OpenAPI response shapes; and Playwright 1.61.0 tests against desktop Chromium plus a mobile viewport.

**Rationale**: The riskiest behavior spans network policy, persistence, and UI state. Layers isolate failures while end-to-end scenarios prove the approved journeys. Pinning Playwright 1.61.0 matches the browser revision preinstalled in the runtime.

**Alternatives considered**:

- End-to-end tests only: too slow and imprecise for URL/IP edge cases.
- Unit tests only: cannot prove persistence, HTTP contracts, responsive UI, or full user journeys.

**Source**: [Playwright browser documentation](https://playwright.dev/docs/browsers)

## Resolved Unknowns

All technical-context questions are resolved. No `NEEDS CLARIFICATION` items remain.
