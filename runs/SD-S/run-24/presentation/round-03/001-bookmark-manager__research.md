# Research: Personal Bookmark Manager

## Decision 1: One TypeScript application with React, Vite, and Express

**Decision**: Use React 19.3 and Vite 8 for the browser interface, Express 5 for a same-origin JSON API and static production serving, and TypeScript 6 in strict mode across client, server, and shared modules. Run on the Node 24 LTS line and commit the npm lockfile.

**Rationale**: The app needs one interactive collection screen and a small persistence API. This combination is current, Node 24 compatible, supports shared types and validation, and results in one production process and start command. Plain CSS is sufficient; routing, global-state, data-query, and component-library dependencies would not solve a current requirement.

**Alternatives considered**:

- Next.js: rejected because server rendering, route conventions, authentication support, and deployment adapters add surface area without user value in this single-screen app.
- Browser-only React with IndexedDB: rejected because persistence would be tied to a browser profile and origin, with weaker operational visibility and more complex relational integrity.
- Separate frontend and backend packages: rejected because independent deployment and versioning are unnecessary for one local application.

**Primary sources**:

- [React versions](https://react.dev/versions)
- [Using TypeScript with React](https://react.dev/learn/typescript)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Vite support policy](https://vite.dev/releases)
- [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/)
- [Express static files](https://expressjs.com/en/starter/static-files.html)
- [Node 24 LTS migration information](https://nodejs.org/en/blog/migrations/v22-to-v24)

## Decision 2: SQLite through `better-sqlite3`

**Decision**: Store data in one file-backed SQLite database through `better-sqlite3` 13.x. Use direct prepared statements, explicit transactions, foreign keys, WAL journal mode, and numbered startup migrations.

**Rationale**: SQLite provides durable transactions and database-enforced constraints without a separate service. The synchronous access model is appropriate for one user and 5,000 records when statements and transactions remain short. `better-sqlite3` is preferred over Node's built-in SQLite module because `node:sqlite` is still documented as release-candidate stability in the pinned Node line.

**Alternatives considered**:

- `node:sqlite`: attractive because it removes a dependency, but deferred until its API is stable.
- JSON file: rejected because the application would need to reproduce atomic replacement, relationships, uniqueness, indexing, and migration behavior.
- PostgreSQL: rejected because provisioning and operating a database server is disproportionate to the approved single-user scope.
- ORM: rejected because three tables and a small set of explicit queries do not justify another abstraction or migration system.

**Primary sources**:

- [SQLite overview](https://sqlite.org/about.html)
- [SQLite transactional guarantees](https://www.sqlite.org/transactional.html)
- [SQLite table constraints](https://sqlite.org/lang_createtable.html)
- [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html)
- [SQLite strict tables](https://www.sqlite.org/stricttables.html)
- [Node 24 SQLite status](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [`better-sqlite3` project documentation](https://github.com/WiseLibs/better-sqlite3)

## Decision 3: Shared validation with server authority

**Decision**: Define request and response schemas with Zod 4 in shared modules. The browser uses them for prompt feedback and typed responses; the Express boundary revalidates every query, path, and body. SQLite repeats critical uniqueness, nullability, relationship, and boolean constraints.

**Rationale**: Shared schemas prevent browser/server drift while maintaining a firm trust boundary. Database constraints remain necessary to close races and protect data from coding errors.

**Alternatives considered**:

- Hand-written duplicate validators: rejected because they are likely to drift across client and server.
- Client-only validation: rejected because requests can bypass the browser.
- Generated clients from OpenAPI in v1: rejected as unnecessary build complexity for five same-repository endpoints; the OpenAPI contract remains the review and integration source.

**Primary source**: [Zod documentation](https://zod.dev/packages/zod)

## Decision 4: Explicit URL and tag identity

**Decision**: Store both the submitted URL and a normalized uniqueness key. Parse using the WHATWG URL model; accept only HTTP and HTTPS; lowercase scheme and host; remove default ports; normalize equivalent root and trailing-slash forms; preserve path case, query content/order, and fragment. Before inserting, return a friendly duplicate response, with the database unique constraint as the final arbiter. Normalize tag comparison keys by trimming, Unicode normalization, whitespace collapsing, and lowercase comparison; preserve the first display spelling.

**Rationale**: Users need predictable duplicate detection without destructive tracking-parameter removal or protocol rewriting. Separate display and comparison values preserve what the user entered while giving the database deterministic identity. Trailing-slash normalization follows the approved specification's explicit duplicate expectation.

**Alternatives considered**:

- Removing fragments or tracking parameters: rejected because fragments and query parameters can identify meaningfully different resources.
- Treating HTTP and HTTPS as identical: rejected because they can resolve differently.
- SQLite `NOCASE` for tags: rejected because its built-in behavior is narrower than explicit Unicode normalization and application-owned comparison rules.

**Primary sources**:

- [WHATWG URL Standard](https://url.spec.whatwg.org/)
- [Node WHATWG URL API](https://nodejs.org/api/url.html)
- [SQLite unique indexes](https://www.sqlite.org/lang_createindex.html)

## Decision 5: REST interface and URL-backed collection view state

**Decision**: Use a small REST JSON interface under `/api`. Encode search, selected tags, status filters, and sort in the browser URL query string. After a mutation, refresh data using the unchanged current query.

**Rationale**: Resource-oriented endpoints map directly to bookmark operations. URL-backed view state survives component changes, supports browser navigation, and makes preservation after mutations explicit without adding a global-state dependency.

**Alternatives considered**:

- GraphQL: rejected because the data graph and query variations are too small to justify a schema runtime and client.
- Component-only transient state: rejected because accidental resets during mutations or refreshes would violate collection-view continuity.
- Persisting view state in SQLite: rejected because it is presentation state, not bookmark data, and the specification does not require it across installations.

## Decision 6: Layered verification with Playwright and WCAG 2.2 AA

**Decision**: Use Vitest for shared/server unit tests, React Testing Library with `user-event` for components, Supertest for HTTP integration, and Playwright 1.61.0 for browser acceptance. Target WCAG 2.2 Level AA using semantic HTML, keyboard-visible focus, accessible error/status messaging, responsive reflow, and careful modal focus. Add axe browser scans but retain manual accessibility checks.

**Rationale**: Each layer catches failures at the cheapest useful boundary, while browser tests prove user journeys and persistence. The environment already provides Playwright 1.61.0 and matching Chromium, so exact pinning avoids browser-revision mismatch. Automated accessibility tools find only some defects; keyboard and assistive-technology checks remain necessary.

**Alternatives considered**:

- Jest: rejected because Vitest shares Vite's transformation pipeline and configuration.
- Cypress: rejected because Playwright is already provisioned and supports isolated contexts, new-tab flows, devices, and web-first assertions.
- Snapshot-heavy component tests: rejected because role, name, state, and behavior assertions express the contract more directly.
- Automated accessibility scans alone: rejected because they cannot establish full WCAG conformance.

**Primary sources**:

- [Vitest features](https://vitest.dev/guide/features)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## Decision 7: Defer automatic title retrieval cleanly

**Decision**: Keep title required and user-entered in v1, exactly as approved. Retain a server-side create service boundary so a future metadata lookup can propose a title before submission without changing the bookmark entity or persistence model.

**Rationale**: This preserves the approved scope while acknowledging the requested future convenience. Fetching arbitrary external URLs introduces timeout, security, network-failure, and metadata-quality policies that deserve their own specification.

**Alternatives considered**:

- Fetch title automatically now: rejected because it contradicts the approved v1 boundary and adds unplanned external network and security behavior.
- Make title optional: rejected because the approved specification requires a title and all current presentation/search behavior relies on it.
