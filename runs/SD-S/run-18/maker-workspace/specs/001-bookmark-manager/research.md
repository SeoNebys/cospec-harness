# Research: Bookmark Manager

**Date**: 2026-09-24

All technical unknowns from planning are resolved. Package versions were checked against current release information on the research date.

## Full-stack application architecture

**Decision**: Use Node.js 24 LTS with TypeScript, React 19.3, and React Router 8.4 Framework Mode in one server-rendered application. Run the built app with `@react-router/serve` on `0.0.0.0:4000`.

**Rationale**: Framework Mode supplies typed routes, loaders, actions, pending form states, resource endpoints, and server rendering without splitting a small CRUD product into independent frontend and backend deployments. The official Node server supports `HOST` and `PORT`, and the architecture keeps domain and security logic independently testable below thin routes.

**Alternatives considered**:

- Next.js 16 is capable, but its React Server Component and caching surface is unnecessary for this application.
- A Vite SPA plus Express API would duplicate routing, validation, and deployment concerns without a requirement for independent clients.
- Static-only delivery cannot protect private data or safely retrieve arbitrary page metadata.

**Sources**: [React Router modes](https://reactrouter.com/start/modes), [deployment](https://reactrouter.com/start/framework/deploying), [`@react-router/serve`](https://reactrouter.com/api/other-api/serve), [Node release schedule](https://nodejs.org/en/about/previous-releases)

## Relational persistence

**Decision**: Use Drizzle ORM 0.45 with `better-sqlite3` 13 and committed SQL migrations. Enable foreign keys, a busy timeout, and WAL mode.

**Rationale**: The required scale and single-instance deployment do not justify an external database. SQLite provides atomic uniqueness, transactions, and deterministic temporary databases for tests. Drizzle keeps constraints and queries typed while leaving generated SQL inspectable. `better-sqlite3` is a stable driver for Node 24; Node's built-in SQLite API remains release-candidate stability.

**Alternatives considered**:

- PostgreSQL is the upgrade path for multiple app instances or greater concurrent writes, but adds infrastructure now.
- Prisma adds a larger generation/runtime surface for three small domain tables.
- Raw SQL is viable but splits migration and schema typing from the auth adapter.
- `node:sqlite` is not yet the conservative production choice while its API stability is release candidate.

**Sources**: [Drizzle SQLite guide](https://orm.drizzle.team/docs/sqlite/get-started-sqlite), [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases), [Node SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [SQLite pragmas](https://sqlite.org/pragma.html), [SQLite WAL](https://sqlite.org/wal.html)

## Authentication and owner isolation

**Decision**: Use Better Auth 1.7 with email/password sign-in, signup disabled at runtime, opaque database-backed sessions, and its Drizzle adapter. Seed two review users only through an explicit non-production command. Derive the owner from the server session and require it in every repository operation.

**Rationale**: Authentication mechanics are supporting infrastructure, not product scope. This setup supplies normal sign-in and revocable sessions without adding registration, recovery, social login, roles, or a hosted dependency. Database and service boundaries both enforce isolation. A foreign resource and a missing resource return the same `404` to avoid disclosing existence.

**Alternatives considered**:

- Custom credential/session code would make security-sensitive hashing, rotation, expiry, CSRF, and revocation application responsibilities.
- Hosted identity adds external setup, availability, and product decisions outside the approved scope.
- Auth.js is viable, but Better Auth has direct Drizzle/SQLite support, signup disabling, database sessions, and first-party test helpers.

**Sources**: [Better Auth installation](https://better-auth.com/docs/installation), [options](https://better-auth.com/docs/reference/options), [security](https://better-auth.com/docs/reference/security), [SQLite adapter](https://better-auth.com/docs/adapters/sqlite), [test utilities](https://better-auth.com/docs/plugins/test-utils)

## Safe page metadata retrieval

**Decision**: Build a dedicated server-only fetcher with Node's `node:http` and `node:https`, manual redirects, prevalidated/pinned DNS results, strict deadlines and byte limits, and inert bounded HTML parsing. Do not use unrestricted global `fetch()`.

**Rationale**: The URL comes from an untrusted user and can otherwise reach loopback, private networks, cloud metadata endpoints, or internal services. The fetcher keeps the original hostname for Host/TLS verification while its custom lookup uses only the validated address snapshot. Every redirect is a new security decision. The connected peer is checked against that snapshot, preventing a second DNS answer from redirecting the connection.

**Policy**:

- Accept only HTTP(S), no credentials, and public multi-label hosts. Inspect only ports 80/443.
- Resolve all addresses and reject the entire hop if any answer is non-public or special-purpose, including mapped and transition IPv6 ranges.
- Pin approved addresses with a custom lookup callback; verify the connected peer and disable cross-hop socket reuse.
- Follow at most three safe redirects; reject HTTPS downgrade, loops, and invalid locations.
- Use a 2.5-second total deadline, 400 ms DNS budget, 750 ms socket inactivity limit, 16 KiB/100-field header bounds, and a 512 KiB body cap.
- Accept successful HTML/XHTML only and request identity encoding.
- Never send cookies, authorization, referrer, proxy credentials, or user-selected headers.
- Parse without scripts/subresources. Stop when metadata is complete or the document head ends.
- Prefer `<title>`, then `og:title`, then `twitter:title`; prefer standard description, then Open Graph, then Twitter description.
- Sanitize, normalize, and cap title at 300 characters and description at 1,000.
- Return a safe hostname/path fallback and blank description for retrieval failures; log only a safe internal reason category.

**Alternatives considered**:

- Undici/global fetch with a custom dispatcher is shorter but makes connection pinning, pooling, and redirects easier to misconfigure.
- Browser-side fetching is unreliable because of cross-origin controls and exposes the user's network context.
- A headless browser executes too much attacker-controlled behavior for metadata extraction.
- An external unfurl provider adds URL privacy, cost, and availability dependencies.

**Sources**: [Node URL API](https://nodejs.org/download/release/latest-v24.x/docs/api/url.html), [DNS API](https://nodejs.org/download/release/latest-v24.x/docs/api/dns.html), [HTTP API](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html), [AbortSignal](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html#static-method-abortsignaltimeoutdelay), [IANA IPv4 special registry](https://www.iana.org/assignments/iana-ipv4-special-registry), [IANA IPv6 special registry](https://www.iana.org/assignments/iana-ipv6-special-registry), [WHATWG title/description semantics](https://html.spec.whatwg.org/multipage/semantics.html), [Open Graph protocol](https://ogp.me/)

## URL normalization and duplicate identity

**Decision**: Parse with WHATWG URL semantics; trim input; prepend `https://` only for recognizable scheme-less hostnames; lowercase scheme/host through serialization; convert IDNs to ASCII; remove fragments and default ports; preserve path and query ordering. Use the serialized result as both the usable stored URL and the per-owner duplicate key. Do not strip tracking parameters or equate HTTP with HTTPS.

**Rationale**: These transformations are deterministic and do not guess that semantically different destinations are equal. The database uniqueness constraint is the final duplicate authority, eliminating check-then-insert races.

**Alternatives considered**:

- Removing tracking parameters could change destinations and needs a separate approved product policy.
- A page's canonical link is untrusted metadata and can unexpectedly merge distinct user-entered URLs.
- Global uniqueness would incorrectly prevent two users from saving the same page.

## Search and filtering

**Decision**: Query SQLite with mandatory owner scope, escaped case-insensitive substring matching across title, URL, description, and tag name, plus an exact normalized tag filter. Combine text and tag criteria with AND and order by creation time then ID descending. Return cursor-paginated pages of 50.

**Rationale**: This meets the 1,000-item scale and deterministic ordering without adding a search service. Pagination bounds render and response work while all matches remain discoverable.

**Alternatives considered**:

- SQLite full-text search is unnecessary at the specified size and complicates synchronization and substring semantics.
- Client-only filtering would require loading the full private collection and makes pagination/performance less predictable.

## Testing and accessibility

**Decision**: Use Vitest 5 for unit/integration/component tests, React Testing Library for interaction semantics, and Playwright pinned to 1.61.0 to match the installed Chromium revision. Run browser tests against a built server and a fresh migrated/seeded test database. Start with one Playwright worker.

**Rationale**: Pure tests cover normalization and security classification exhaustively; real temporary SQLite tests prove constraints and owner scoping; component tests cover asynchronous editor behavior; a small browser layer proves session wiring and user journeys. Separate browser contexts model two concurrently authenticated users without cookie leakage.

**Alternatives considered**:

- Browser tests alone are slower and cannot efficiently exhaust SSRF or ownership matrices.
- Mock-only persistence tests would not verify migrations, constraints, or query scoping.
- The newest Playwright package is intentionally not used because the provided browser binaries are revision-matched to 1.61.0.

**Sources**: [Vitest database transaction recipe](https://vitest.dev/guide/recipes/db-transaction), [Playwright isolation](https://playwright.dev/docs/browser-contexts), [authentication](https://playwright.dev/docs/auth), [web server configuration](https://playwright.dev/docs/test-webserver)
