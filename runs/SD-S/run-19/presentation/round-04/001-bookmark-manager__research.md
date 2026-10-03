# Phase 0 Research: Bookmark Manager

## Decision 1: Single-process TypeScript web application

**Decision**: Use a React 19 client built by Vite and an Express 5 server in one npm package. The production Express process serves both the built client and the same-origin JSON API.

**Rationale**: Metadata retrieval cannot reliably or safely run in a browser because cross-origin page access is restricted and network policy must be enforced server-side. One process keeps this private single-user deployment small, avoids cross-origin configuration, and supports the required `0.0.0.0:4000` runtime. React's current documented major is 19, and Vite supports the available Node 24 runtime ([React versions](https://react.dev/versions), [Vite guide](https://vite.dev/guide/), [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/)).

**Alternatives considered**:

- Browser-only local storage: rejected because arbitrary page metadata cannot be fetched reliably and data would be tied to one browser profile.
- Next.js or another full-stack meta-framework: capable but adds routing and server-rendering concepts not needed for this three-flow application.
- Separate frontend and backend packages: rejected because independent deployment and package coordination provide no v1 value.

## Decision 2: SQLite through better-sqlite3

**Decision**: Persist data in a local SQLite file using better-sqlite3 13.x, with prepared statements, transactions, foreign keys, WAL mode, and versioned startup migrations.

**Rationale**: SQLite is durable, portable, and well matched to one user and 10,000 records. better-sqlite3 provides a small synchronous API, transactions, and Node 24 builds; its current major uses N-API and publishes prebuilt binaries ([better-sqlite3 project](https://github.com/WiseLibs/better-sqlite3), [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases)).

**Alternatives considered**:

- Node's built-in `node:sqlite`: attractive because it removes a dependency, but Node 24 documentation still labels the module release-candidate stability, so it is not selected for the first release ([Node 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)).
- PostgreSQL: rejected because a separately managed database is unnecessary for a private single-user app.
- JSON files: rejected because concurrent-safe updates, relational tags, migrations, and multi-field search would need custom persistence logic.

## Decision 3: Bounded, SSRF-resistant metadata retrieval

**Decision**: Build a small server-side metadata fetcher with Node HTTP clients and a controlled DNS lookup. It accepts only public HTTP(S) destinations, validates all resolved IPv4/IPv6 addresses, pins the selected validated address for the connection, checks every redirect, and enforces redirect, time, content-type, and body-size limits.

**Rationale**: A user-provided URL makes the server a potential SSRF proxy. OWASP guidance calls for rejecting private, localhost, and link-local ranges, checking all resolved addresses, and preventing redirects from bypassing validation ([OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)). Address pinning closes the gap between DNS validation and connection. Limits keep slow or oversized destinations from consuming the small application's resources.

**Alternatives considered**:

- Native `fetch` after a one-time hostname check: rejected because a second DNS resolution or unchecked redirect can defeat the original validation.
- Third-party metadata service: rejected because it adds cost, availability, and privacy dependencies to a self-contained app.
- Headless browser extraction: rejected because executing remote pages is resource-heavy and unnecessary for titles and descriptions.

## Decision 4: HTML metadata precedence and fallback

**Decision**: Parse received HTML without script execution. Prefer a page-provided social title, then the document title; prefer a page-provided social description, then the standard description. Normalize whitespace and discard empty values. If the title is missing or retrieval fails, derive a readable title from the hostname and final meaningful path segment; leave a missing description empty.

**Rationale**: This ordering captures intentional sharing metadata when present while retaining ordinary HTML support. A deterministic address-derived fallback directly satisfies the approved non-blocking save workflow.

**Alternatives considered**:

- Require manual title entry on failure: rejected by the approved specification.
- Generate summaries from page text: rejected as unpredictable, more expensive, and beyond the requested short page-supplied description.
- Retrieve images and icons: explicitly outside v1 scope.

## Decision 5: Shared runtime validation and stable API contract

**Decision**: Define request/response schemas with Zod in `src/shared/schemas.ts`, use them at API boundaries, and document the public behavior in `contracts/openapi.yaml`.

**Rationale**: One source of runtime validation keeps browser and server expectations aligned. The OpenAPI artifact makes error behavior, duplicate confirmation, filters, and fallback metadata testable before implementation.

**Alternatives considered**:

- TypeScript types alone: rejected because static types do not validate browser or network input at runtime.
- Handwritten validation in every route: rejected because duplicated rules drift easily.

## Decision 6: Layered deterministic testing

**Decision**: Use Vitest for unit/integration tests, React Testing Library for UI behavior, Supertest for API contracts, and Playwright 1.61.0 for Chromium end-to-end flows. Inject DNS and transport dependencies into the metadata service so security and failure cases do not depend on live internet behavior.

**Rationale**: Vitest integrates with Vite's configuration ([Vitest guide](https://vitest.dev/guide/)); Playwright exercises real browser behavior ([Playwright test guide](https://playwright.dev/docs/running-tests)). Deterministic fixtures are necessary to prove redirects, timeouts, missing fields, and fallback handling consistently.

**Alternatives considered**:

- Live internet pages in automated tests: rejected because remote content and availability are nondeterministic.
- End-to-end tests only: rejected because URL policy and network failure branches need focused coverage.
