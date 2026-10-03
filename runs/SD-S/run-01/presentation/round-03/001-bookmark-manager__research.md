# Technical Research: Personal Bookmark Manager

**Date**: 2026-09-16

All technical-context questions are resolved. This research favors a small, locally runnable system that meets the approved single-user scope and can be validated without external services.

## Decision 1: One TypeScript Full-Stack Application

**Decision**: Use TypeScript throughout, with a React 19 client built by Vite and an Express 5 server that serves both the JSON API and production assets.

**Rationale**: One language and one package reduce setup and type duplication. React fits the interaction-heavy collection, form, filters, and dialogs. Vite provides a supported React TypeScript starting point and optimized production assets. Express provides a small routing and static-serving layer without imposing a larger application framework. One production process is sufficient for a single-user application and matches the review harness.

**Alternatives considered**:

- **Server-rendered templates with progressively enhanced JavaScript**: fewer client dependencies, but collection filtering, dialogs, optimistic feedback, and view-state preservation would require more bespoke browser code and split interaction patterns.
- **Next.js or another full-stack framework**: capable, but its routing, rendering, and deployment abstractions exceed the needs of two collection views and a local SQLite store.
- **Client-only storage**: smallest runtime, but browser-local data is harder to back up, test across sessions, and evolve toward server-side metadata fetching.

**Sources**: [React recommends frameworks or build tools such as Vite for new applications](https://react.dev/learn/build-a-react-app-from-scratch); [Vite includes a React TypeScript template and production build pipeline](https://vite.dev/guide/); [Express can serve generated static assets](https://expressjs.com/en/starter/static-files/).

## Decision 2: SQLite with `better-sqlite3`

**Decision**: Persist data in SQLite through `better-sqlite3`, enable WAL mode and foreign keys, and manage a small ordered set of SQL migrations directly.

**Rationale**: SQLite provides durable relational storage in one file, transactions, indexes, and no external service. `better-sqlite3` supports current Node releases, has a direct synchronous API, and exposes transactions cleanly. At this application's scale, short synchronous queries avoid callback complexity without creating meaningful contention. The built-in Node SQLite module was considered but remains release-candidate stability in Node 24, so a mature dependency is safer for the first release.

**Alternatives considered**:

- **Node's built-in `node:sqlite`**: removes a dependency but is still marked release candidate in the Node 24 documentation.
- **PostgreSQL**: strong multi-user choice, but requires an external service and operational overhead that the single-user scope does not justify.
- **JSON file persistence**: simple initially, but atomic multi-entity updates, indexing, recovery, and schema migration would need custom implementations.
- **ORM layer**: helpful for a larger domain, but direct parameterized SQL is clearer for three tables and avoids generated clients or schema duplication.

**Sources**: [`better-sqlite3` documents transaction support and current supported-Node compatibility](https://github.com/WiseLibs/better-sqlite3); [Node 24 labels `node:sqlite` release candidate](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html); [SQLite documents transaction guarantees](https://www.sqlite.org/lang_transaction.html); [SQLite foreign keys must be explicitly enabled](https://www.sqlite.org/foreignkeys.html).

## Decision 3: Relational Substring Search, Not FTS

**Decision**: Implement case-insensitive, escaped substring search over bookmark title, URL, notes, and joined tag names using parameterized SQL, with indexes for scope/filter/sort fields.

**Rationale**: The approved scale is 1,000 bookmarks and the expected behavior is simple matching, not relevance ranking, stemming, or page-content search. Ordinary queries are easier to reason about, preserve literal user input semantics, and avoid maintaining a second search index. Search and filters remain server-side so one contract governs all clients and the performance criterion can be tested end to end.

**Alternatives considered**:

- **SQLite FTS5**: valuable for large text collections and ranked token search, but unnecessary at this scale and inconsistent with straightforward substring expectations.
- **Client-only filtering**: responsive after initial load, but transfers the entire collection, duplicates filtering logic, and makes persistence/API behavior less independently testable.

**Source**: [SQLite describes FTS5 as a full-text indexing system for term-based document search](https://www.sqlite.org/fts5.html).

## Decision 4: Shared Runtime Validation

**Decision**: Use Zod 4 schemas in `src/shared` for request bodies, query parameters, and response-facing domain shapes. Use native URL parsing for protocol checks and canonicalization. The API validates every inbound value regardless of client validation.

**Rationale**: TypeScript types disappear at runtime, so the HTTP boundary needs executable validation. Shared schemas keep client feedback and server enforcement aligned while still allowing the server to reject malformed direct requests. Allow-listed sort/scope values also prevent unsafe dynamic query construction.

**Alternatives considered**:

- **Handwritten validation**: avoids a dependency but tends to duplicate rules and error formatting across client and server.
- **JSON Schema plus generated types**: strong for a public multi-language API, but adds generation steps for a single TypeScript application.

**Source**: [Zod describes itself as TypeScript-first schema declaration and validation](https://zod.dev/).

## Decision 5: Layered Verification with User-Facing Tests

**Decision**: Use Vitest for fast unit/integration execution, React Testing Library for component behavior, Supertest for HTTP contracts, and the environment-pinned Playwright 1.61.0 for Chromium end-to-end, responsive, and accessibility-assisted checks.

**Rationale**: The specification is expressed as user scenarios but also contains important normalization, persistence, and error invariants. Testing at complementary boundaries keeps failures local while end-to-end tests prove complete journeys. Role- and label-based queries reinforce usable semantics. Browser checks cover the small- and large-screen requirement and the shared harness readiness contract.

**Alternatives considered**:

- **End-to-end tests only**: realistic but slower and less diagnostic for query, validation, and transaction edge cases.
- **Unit tests only**: fast but cannot prove browser/API/database integration, persistence, focus management, or responsive layout.
- **Downloading a separate browser revision**: unnecessary and conflicts with the supplied Playwright/browser pairing.

**Sources**: [Vitest integrates with Vite configuration](https://vitest.dev/guide/); [React Testing Library favors tests resembling user interaction](https://testing-library.com/docs/react-testing-library/intro/); [Playwright supports desktop and mobile emulation](https://playwright.dev/docs/emulation); [Playwright documents automated accessibility checks and their limits](https://playwright.dev/docs/accessibility-testing).

## Decision 6: Explicit API and UI Error States

**Decision**: Standardize API errors as `{ error: { code, message, fieldErrors?, details? } }`, preserve form inputs after failed requests, and expose distinct loaded-empty, no-results, loading, and failure states. Use a two-step duplicate flow and a modal confirmation before permanent deletion.

**Rationale**: The approved requirements call for actionable validation, duplicate choice, success/failure communication, distinct empty states, and destructive confirmation. Stable error codes let the client implement those experiences without parsing prose. Confirmation remains a UI responsibility, while the API additionally refuses deletion of active records.

**Alternatives considered**:

- **Generic toast for all errors**: simpler but cannot guide field corrections or support the duplicate decision flow.
- **Server-issued delete token**: stronger proof of a confirmation round trip, but adds state and complexity without authentication or concurrent users; archived-only deletion plus tested UI confirmation is proportionate here.

## Decision 7: No Metadata Fetching in Version One

**Decision**: Require the user to enter a non-blank title. Do not fetch destination HTML, titles, icons, descriptions, or images during creation.

**Rationale**: This exactly reflects the approved specification. It keeps saves deterministic, avoids network and security concerns around server-side URL fetching, and requires no external connectivity. A later spec can add an asynchronous metadata state and protected fetcher without changing bookmark identity or lifecycle fields.

**Alternatives considered**:

- **Fetch metadata synchronously on save**: convenient but introduces latency, unreachable-site errors, SSRF protections, content parsing, and precedence questions when the user edits a title.
- **Client-side page fetch**: generally blocked by cross-origin browser policies and would behave inconsistently across sites.
