# Research: Personal Bookmark Manager

**Date**: 2026-09-18  
**Status**: Complete; no unresolved technical clarifications

## Decision 1: React/Vite Client with Fastify Server

**Decision**: Use React 19.3 and Vite 8.3 for the browser application, Fastify 5.12 for the server, and one TypeScript repository and production process.

**Rationale**: The product is a private, interaction-heavy application with no public SEO or server-rendering requirement. Vite provides a conventional client build, while Fastify provides an explicit API boundary, schema-oriented routing, static-file delivery, and request injection for tests. The final process can serve both `/api/*` and the SPA on port 4000.

**Alternatives considered**:

- Next.js: viable, but its server-rendering, React Server Components, and caching model add concepts the product does not need.
- Separate client and server deployments: rejected because v1 gains no functional value from cross-origin deployment and would complicate cookies, CORS, and operations.
- Server-rendered templates without React: fewer dependencies, but state-rich filtering, previews, optimistic updates, and responsive editing would be harder to organize and test.

**Primary sources**: [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [React from-scratch guidance](https://react.dev/learn/build-a-react-app-from-scratch), [Vite guide](https://vite.dev/guide/), [Fastify TypeScript reference](https://fastify.dev/docs/latest/Reference/TypeScript/), [Fastify testing guide](https://fastify.dev/docs/latest/Guides/Testing/)

## Decision 2: SQLite, Drizzle, and a Single Migration Path

**Decision**: Use `better-sqlite3` with SQLite on local persistent disk, Drizzle for typed schema/query access and migrations, WAL mode, enforced foreign keys, and a five-second busy timeout.

**Rationale**: SQLite comfortably handles the single-node v1 scope and 10,000 bookmarks per user without a separate database service. `better-sqlite3` is mature and test-friendly. Node 24's built-in SQLite API remains release-candidate stability. Drizzle is already needed for Better Auth's recommended adapter and lets auth and application schema evolve through one checked-in migration system.

**Alternatives considered**:

- Node `node:sqlite`: avoids a dependency but is not yet marked stable in Node 24.
- PostgreSQL: a sound future option for multi-node deployment, but unnecessary operational weight for v1.
- Direct SQL without Drizzle: simple for application tables, but would split schema and migration ownership from Better Auth.
- Prisma: capable, but adds a larger generation/runtime layer than this schema needs.

**Primary sources**: [Node 24 SQLite status](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3), [Drizzle SQLite guide](https://orm.drizzle.team/docs/sqlite/get-started-sqlite), [SQLite WAL](https://www.sqlite.org/wal.html), [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html)

## Decision 3: Better Auth for Email/Password Accounts

**Decision**: Use Better Auth 1.7 with its Drizzle adapter for registration, sign-in, sign-out, database-backed sessions, rate limiting, and password reset. Use Nodemailer behind an injected mail interface for reset delivery.

**Rationale**: Authentication and recovery have subtle security and lifecycle requirements. Better Auth already supports Fastify, SQLite/Drizzle, scrypt password hashing, session revocation, generic reset behavior, trusted origins, and secure cookies. This removes a large body of custom security code while preserving self-hosted user data.

**Configuration decisions**:

- Email/password enabled; email verification not required in v1.
- Password length 15–128; Better Auth's scrypt hashing.
- Database sessions: seven-day expiry, one-day rolling refresh, cookie cache disabled.
- Password-reset token: one hour, hashed identifier, single use, revoke sessions on successful reset.
- Host-only `HttpOnly`, `SameSite=Lax` session cookie; `Secure` in production.
- Exact trusted origins and configured base URL; database-backed rate limits in all environments.
- SMTP production transport, in-memory test transport, explicit console-only development transport.

**Alternatives considered**:

- Custom scrypt/session/reset implementation: feasible with Node crypto, but creates avoidable security maintenance and more integration tests.
- Managed identity provider: reduces auth code but adds vendor availability, hosted user data, and external review-environment setup.
- Stateless cookie sessions: simple, but immediate revocation after password reset and server-side session management are clearer with database sessions.

**Primary sources**: [Better Auth email/password](https://better-auth.com/docs/authentication/email-password), [Better Auth security](https://better-auth.com/docs/reference/security), [Better Auth session management](https://better-auth.com/docs/concepts/session-management), [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Better Auth Fastify integration](https://better-auth.com/docs/integrations/fastify), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP forgot password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Nodemailer SMTP](https://nodemailer.com/smtp)

## Decision 4: Same-Origin JSON and Layered CSRF Protection

**Decision**: Serve browser and API from one origin. For application mutations, require `application/json`, an app-specific custom header, matching `Origin`, and non-cross-site Fetch Metadata. Keep all mutations off GET routes and do not enable permissive CORS. Better Auth continues to protect its own endpoints.

**Rationale**: A custom header makes cross-origin simple-form requests insufficient; origin and Fetch Metadata checks add independent protection; host-only SameSite cookies reduce exposure. The same-origin deployment avoids CORS complexity.

**Alternatives considered**:

- SameSite cookies alone: useful defense in depth but insufficient as the only control.
- Synchronizer tokens: secure, but unnecessary for the JSON-only application API when custom headers and origin checks are enforced. Add them if server-rendered form posts are introduced.

**Primary source**: [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Decision 5: Safe, Non-Blocking Metadata Capture

**Decision**: Fetch titles and site icons on the server through a purpose-built bounded HTTP client. Metadata preview is best-effort; bookmark persistence never depends on it. Valid public IP resolution is pinned into the actual connection and revalidated on every redirect.

**Rationale**: Browser-side retrieval is unreliable because of CORS. Ordinary unpinned server fetches can expose internal services through SSRF or DNS rebinding. Connection pinning, complete address classification, manual redirect handling, response limits, and a short overall deadline make the feature auditable. Fallback metadata preserves the requested saving experience.

**Key choices**:

- Support metadata retrieval only for public HTTP(S) destinations on default ports; still save other syntactically valid HTTP(S) bookmarks with fallback metadata.
- Reject non-global A/AAAA answers using IANA special-purpose registries and reject a hop if any answer is non-public.
- Pin the chosen address using Node HTTP/HTTPS connection lookup, retain hostname for Host/SNI, verify the connected peer, and repeat for every redirect.
- Five redirect maximum; no automatic redirects, retries, credentials, cookies, HTTPS downgrade, or keep-alive.
- Overall 4.5-second deadline, 16 KiB headers, 1 MiB HTML, 256 KiB icon, identity encoding, and accepted content types only.
- Inert parsing without JavaScript; title precedence is document title, Open Graph title, Twitter title, then hostname fallback.
- Validate icon magic bytes; accept PNG/JPEG/GIF/WebP/ICO, reject SVG, persist content-addressed bytes, and serve them locally.
- Track title source (`page`, `fallback`, `user`) and conditionally apply late metadata only to fallback titles.

**Alternatives considered**:

- Plain `fetch(url)`: simpler, but does not by itself provide explicit DNS-to-socket pinning and per-hop validation.
- Headless browser: improves JavaScript-generated metadata coverage but greatly expands resource use and attack surface.
- Third-party metadata service: easier, but leaks private bookmark destinations and adds a vendor dependency.
- Remote favicon hotlinks: rejected because icons would not be reliably preserved and would reveal user activity to third parties.

**Primary sources**: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry), [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry), [IANA special-use domains](https://www.iana.org/assignments/special-use-domain-names), [Node 24 HTTP](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html), [Node 24 HTTPS](https://nodejs.org/download/release/latest-v24.x/docs/api/https.html), [Node 24 DNS](https://nodejs.org/download/release/latest-v24.x/docs/api/dns.html), [WHATWG HTML title](https://html.spec.whatwg.org/dev/semantics.html#the-title-element), [WHATWG icon processing](https://html.spec.whatwg.org/multipage/links.html#rel-icon)

## Decision 6: Trigram FTS with a Short-Query Fallback

**Decision**: Maintain a user-scoped FTS5 table with the trigram tokenizer for title, URL, and aggregated tag search. Use an escaped scoped `LIKE` scan for terms shorter than three characters.

**Rationale**: The requirement calls for partial case-insensitive matching, not only word-prefix matching. SQLite's trigram tokenizer is designed for substring search. Maintaining the row transactionally keeps results predictable, and a 10,000-row fallback scan for one- or two-character searches is acceptable when measured.

**Alternatives considered**:

- Prefix-token FTS: faster and smaller, but does not meet general substring behavior.
- `LIKE` for every query: probably adequate at current scale but offers less headroom and less predictable multi-field search performance.
- External search service: unjustified for v1 scale and deployment goals.

**Primary sources**: [SQLite FTS5](https://www.sqlite.org/fts5.html), [SQLite query planner](https://www.sqlite.org/queryplanner.html)

## Decision 7: Layered Automated Verification

**Decision**: Use Vitest 5 for unit/component/integration tests and pin Playwright to 1.61.0 because that exact browser revision is preinstalled in the workspace.

**Rationale**: Vitest integrates with the Vite/TypeScript project, Fastify can be tested without opening sockets, and Playwright covers only the high-value browser journeys against a production build. Real temporary SQLite files catch migration, FTS, WAL, and constraint behavior that mocks would miss.

**Alternatives considered**:

- Browser-only testing: too slow and imprecise for metadata/security edge cases.
- Mocked repository tests only: would miss SQLite constraints and query behavior.
- Latest Playwright release: rejected because its required browser build would not match the supplied 1.61.0 binaries.

**Primary sources**: [Vitest guide](https://vitest.dev/guide/), [Playwright browser version coupling](https://playwright.dev/docs/browsers), [Playwright web server](https://playwright.dev/docs/test-webserver)
