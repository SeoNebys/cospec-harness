# Technical Research: Bookmark Manager

**Date**: 2026-09-27  
**Status**: Complete — no unresolved clarifications

## 1. Application Runtime and Framework

**Decision**: Use Node.js 24 LTS with TypeScript and the Next.js 16 App Router as a single Node-hosted application.

**Rationale**: Node.js 24 is the runtime already supplied by the project environment and remains supported through April 2028. Next.js 16 is the current active-LTS line, supports Node.js 24, and can run all required dynamic features from one ordinary Node.js server. A single full-stack process keeps authentication, HTML rendering, JSON endpoints, metadata retrieval, and persistence together without adding a cross-service contract.

**Alternatives considered**:

- Separate React SPA plus Express API: adds deployment, CORS, and session complexity without a scope benefit.
- Static-only client application: cannot safely fetch arbitrary page metadata or keep private account data.
- Python/FastAPI backend: viable, but would still require a separate frontend and does not use the provided Node-first application runtime as directly.

**Sources**: [Next.js 16 support policy](https://nextjs.org/support-policy), [Next.js deployment guide](https://nextjs.org/docs/app/getting-started/deploying), [Node.js 24 LTS migration notice](https://nodejs.org/en/blog/migrations/v22-to-v24)

## 2. Persistence and Search

**Decision**: Use `better-sqlite3` against one SQLite file in WAL mode, explicit SQL migrations, repository modules, and an FTS5 table for search.

**Rationale**: The first release is a single-node application and its stated per-user volume is modest for indexed SQLite. `better-sqlite3` is mature, supports transactions and virtual tables, and avoids choosing Node's still-release-candidate `node:sqlite` API. FTS5 provides indexed, case-insensitive full-text retrieval while normal indexes handle ownership, lifecycle, favorite, and tag filters.

**Alternatives considered**:

- Node's built-in `node:sqlite`: fewer dependencies, but its Node 24 API remains release-candidate stability.
- PostgreSQL: better for multi-instance/high-write deployments, but requires an external service that the approved scope and review environment do not need.
- An ORM: useful for large schemas, but direct parameterized SQL plus a narrow repository layer keeps FTS5, triggers, migrations, and transaction boundaries explicit for this small schema.
- `LIKE` across joined tables: simpler initially, but provides less predictable retrieval performance as libraries approach 10,000 bookmarks.

**Sources**: [Node.js SQLite stability](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [`better-sqlite3` project documentation](https://github.com/WiseLibs/better-sqlite3), [SQLite FTS5 documentation](https://www.sqlite.org/fts5.html)

## 3. Authentication and Account Recovery

**Decision**: Use Better Auth with email/password authentication, database-backed sessions, secure same-site cookies, and its password-reset flow. Back email delivery with an SMTP adapter in production and an in-memory sink in tests/development.

**Rationale**: Authentication is security-sensitive and is not product differentiation here. Better Auth provides an official Next.js route-handler integration, recommends `better-sqlite3`, includes email/password and password-reset support, and maintains database sessions. Each protected data operation will still perform server-side authorization rather than relying on routing middleware.

**Alternatives considered**:

- Hand-built password and session system: possible with Node crypto, but unnecessarily expands security-sensitive code.
- Auth.js credentials provider: suitable for sign-in, but registration and password recovery would still need substantial custom lifecycle code.
- Hosted identity provider: robust, but creates an external account and network dependency for local review and deployment.

**Sources**: [Better Auth installation](https://better-auth.com/docs/installation), [Next.js integration](https://better-auth.com/docs/integrations/next), [email/password and reset behavior](https://better-auth.com/docs/authentication/email-password)

## 4. Safe Page-Metadata Retrieval

**Decision**: Fetch through `undici` with a custom dispatcher/lookup guard, manual redirects, a total deadline, size/media limits, and public-address checks at connection time. Parse already-fetched bounded bytes with Cheerio; do not use a convenience `fromURL` call.

**Rationale**: The destination is controlled by the user, making metadata retrieval an SSRF boundary. Merely validating the input hostname before calling `fetch` leaves redirect and DNS-rebinding gaps. Every connection and redirect must be limited to HTTP(S) and a public IPv4/IPv6 destination. Cheerio's byte-loading API handles page encoding without controlling network behavior.

**Alternatives considered**:

- Client-side metadata retrieval: browsers block most cross-origin HTML access and would expose each user directly to target sites.
- A third-party preview API: simpler but adds cost, privacy exposure, rate limits, and an external availability dependency.
- Cheerio `fromURL`: convenient, but its automatic redirect behavior does not provide the explicit per-hop security boundary needed for user-supplied URLs.
- Headless Chromium: handles script-rendered pages, but is slower, heavier, and increases attack surface; standard published metadata satisfies the approved scope.

**Sources**: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP Node.js SSRF guidance](https://community.owasp.org/pages/controls/SSRF_Prevention_in_Nodejs), [Cheerio byte-loading documentation](https://cheerio.js.org/docs/basics/loading/)

## 5. Metadata Failure and Timing Model

**Decision**: Keep metadata retrieval inside the create request with one four-second total budget and no retries. If it fails or yields no title, save a fallback title derived from the normalized address and return `metadataStatus` plus a user-safe message.

**Rationale**: This directly satisfies the requirement that a bookmark is saved even when a page is unreachable, while keeping the deployment free of a background queue. A four-second internal deadline leaves response/render headroom for the five-second title success target. Optional icon work stops when the shared budget is exhausted.

**Alternatives considered**:

- Background worker and queue: improves request latency but adds another process, eventual-state UI, retries, and operational complexity that are not needed at this scale.
- Reject on metadata failure: contradicts the approved specification.
- Unlimited or retried retrieval: risks slow saving and resource exhaustion.

## 6. Icon Handling

**Decision**: Fetch only a published raster icon through the guarded metadata client, cap it at 128 KiB, content-check it, hash it, and store deduplicated bytes in SQLite. Serve it from a same-origin, immutable icon endpoint.

**Rationale**: Same-origin stored icons avoid leaking a user's library-view activity to third-party icon hosts, avoid broken mixed-content icons, and prevent the browser from repeatedly resolving an attacker-controlled icon URL. Rejecting SVG avoids active content. Deduplication limits common favicon storage.

**Alternatives considered**:

- Store and render the remote URL: simple, but leaks client requests and can change after validation.
- Store icons as data URLs on each bookmark: duplicates bytes and bloats every bookmark response.
- Skip icons: safe but does not fulfill the approved best-effort icon requirement.

## 7. Interface Boundary and Concurrency

**Decision**: Use JSON route handlers for bookmark/tag operations, the library's conventional auth handler for identity, cursor pagination, and optimistic concurrency through a required bookmark version on update/delete.

**Rationale**: Explicit route contracts are straightforward to validate and keep client interactions decoupled from internal modules. Cursor pagination remains stable as bookmarks are added. A version field prevents two tabs from silently overwriting one another.

**Alternatives considered**:

- Server Actions only: ergonomic for forms but harder to contract-test as a stable application interface.
- Offset pagination: simpler but can skip or duplicate entries as the newest-first list changes.
- Last-write-wins updates: risks invisible data loss.

## 8. Testing Strategy

**Decision**: Use Vitest 5 for unit/integration/contract tests and pin Playwright 1.61.0 for browser tests, matching the preinstalled browser revision. Inject the outbound network transport and mail sink in tests.

**Rationale**: Vitest 5 supports Node 24 and handles TypeScript-focused fast tests. Playwright exercises the actual responsive and accessible flows. Transport injection allows deterministic metadata tests, including hostile redirects and DNS results, without weakening production address checks or relying on the public internet.

**Alternatives considered**:

- Browser tests only: too slow and imprecise for network-security and database invariants.
- Live internet metadata tests: nondeterministic and unsuitable for offline CI.
- Downloading latest Playwright browsers: explicitly conflicts with the supplied runtime constraint.

**Sources**: [Vitest guide](https://vitest.dev/guide/), [Playwright testing documentation](https://playwright.dev/docs/intro)
