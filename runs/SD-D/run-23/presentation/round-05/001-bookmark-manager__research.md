# Technical Research: Bookmark Manager

**Date**: 2026-09-25  
**Status**: Complete — no unresolved technical clarifications

## Decision 1: Single-process TypeScript web application

**Decision**: Use Node.js 24.21, TypeScript 5.9, a React 19 SPA built by Vite 8, and a Fastify 5 JSON API. TypeScript 5.9 is selected because the approved lint toolchain currently declares compatibility below TypeScript 6. In production and review, Fastify serves both `/api/*` and the built SPA from one process on port 4000.

**Rationale**: The product is private and interaction-heavy, so public-page server rendering adds little value. A same-origin client/API avoids cross-origin session complexity and matches the required harness runtime.

**Alternatives considered**: Next.js or React Router framework mode would add server-rendering and deployment boundaries without a current SEO requirement. Separate frontend and backend processes would complicate local review and cookie handling.

**Sources**: [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [Vite 8](https://vite.dev/blog/announcing-vite8), [Fastify documentation](https://fastify.dev/docs/latest/)

## Decision 2: SQLite, Drizzle, and replaceable repositories

**Decision**: Use SQLite through better-sqlite3 and Drizzle ORM, enable foreign keys and WAL mode, set a nonzero busy timeout, and commit numbered SQL migrations. Keep database access behind repository interfaces.

**Rationale**: SQLite is operationally simple and sufficient for a single-node application with 10,000 bookmarks per user. better-sqlite3 is mature and gives direct transaction/FTS access. Drizzle keeps ordinary schema work typed without obscuring specialized SQL.

**Alternatives considered**: Node's built-in `node:sqlite` removes a dependency but is still stability 1.2/release-candidate in Node 24. PostgreSQL is the preferred future move for horizontal scaling or high write concurrency, but adds unnecessary operations now. Prisma is heavier and less direct for FTS5-specific work.

**Sources**: [Drizzle SQLite drivers](https://orm.drizzle.team/docs/sqlite/get-started-sqlite), [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [Node 24 SQLite status](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [SQLite WAL](https://www.sqlite.org/wal.html)

## Decision 3: Application grammar compiled to FTS5 and relational sets

**Decision**: Parse bare terms, quoted phrases, `tag:` values, unary `NOT`, infix `AND`/`OR`/`NOT`, adjacency-as-AND, and parentheses into a source-positioned AST. Use precedence `NOT`, then `AND`/adjacency, then `OR`. Resolve tag names to stable IDs. Compile text leaves into safely quoted, bound FTS5 expressions and combine text/tag result sets with `INTERSECT`, `UNION`, and a tenant-scoped `EXCEPT` universe.

**Rationale**: Passing user text directly to FTS exposes surprising syntax and poor errors. An AST produces the approved user semantics, error locations, stable saved views, and tenant-safe negation. FTS5 provides Unicode-aware token search and phrase positions.

**Alternatives considered**: SQL `LIKE` is simpler but scales poorly over large notes. Passing through raw FTS5 syntax makes application behavior depend on SQLite quirks. Encoding tags into the text index makes exact identity and rename handling fragile.

**Sources**: [SQLite FTS5 syntax and external-content tables](https://www.sqlite.org/fts5.html)

## Decision 4: Unicode-aware names and search

**Decision**: Normalize user-managed names in application code with Unicode NFKC, trim surrounding whitespace, collapse internal whitespace for label keys, and apply locale-independent case folding. Store both display values and normalized uniqueness keys. Configure FTS5 with `unicode61 remove_diacritics 2` and keep full positional detail for phrases.

**Rationale**: SQLite's built-in `NOCASE` is ASCII-oriented. Explicit normalized keys make tag, collection, and saved-view uniqueness deterministic while preserving original display text.

**Alternatives considered**: Relying on database collation is smaller but fails the international-character requirement. Porter stemming is English-specific and therefore unsuitable as the default.

**Source**: [SQLite FTS5 tokenizers](https://www.sqlite.org/fts5.html#tokenizers)

## Decision 5: Guarded metadata retrieval with DNS pinning

**Decision**: Create a dedicated Undici client for metadata retrieval. Accept only HTTP(S) URLs without credentials; manually process at most five redirects; resolve every hop's A and AAAA records; reject any non-public address; and pin the vetted address for the connection while preserving hostname verification. Apply a shared 4.5-second deadline, connection/header/body timeouts, 16 KiB header and 2 MiB HTML limits, no cookies or authorization, and no retries in the interactive flow.

**Rationale**: URL fetching is an SSRF boundary. Validating only the initial hostname or allowing the HTTP client to resolve again leaves redirect and DNS-rebinding bypasses. Bounded time and bytes preserve the non-blocking save experience.

**Alternatives considered**: Ordinary global `fetch(url)` is insufficient for address pinning. A managed unfurl service reduces custom networking but adds cost, privacy exposure, and vendor dependency. A separate locked-down fetch worker is a later defense-in-depth deployment option.

**Sources**: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Node DNS lookup](https://nodejs.org/api/dns.html#dnspromiseslookuphostname-options), [Node net.BlockList](https://nodejs.org/api/net.html#class-netblocklist), [Undici Client options](https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md)

## Decision 6: Static metadata parsing and deterministic precedence

**Decision**: Parse bounded HTML with Cheerio without executing JavaScript or loading subresources. Prefer `og:title`, then `<title>`, then hostname; prefer `og:description`, then the standard description meta element; prefer the first valid Open Graph image, then Twitter image; and prefer declared icons, then same-origin `/favicon.ico`. Resolve relative URLs against the final response URL, never replace the saved destination with canonical metadata, and auto-fill only fields the user has not edited.

**Rationale**: Static extraction covers normal publisher metadata without the risk and cost of headless browsing. Deterministic precedence and untouched-field tracking prevent a late response from overwriting user intent.

**Alternatives considered**: Executing page JavaScript expands attack surface and usually adds no value for standard metadata. Replacing the bookmark URL with `og:url` could redirect the user's saved intent.

**Sources**: [Open Graph protocol](https://ogp.me/), [HTML meta description](https://html.spec.whatwg.org/multipage/semantics.html#meta-description), [HTML icon links](https://html.spec.whatwg.org/multipage/links.html#rel-icon)

## Decision 7: Owned media proxy with bounded cache

**Decision**: Store metadata image URLs but render them through an authenticated endpoint addressed by bookmark ID and asset kind. Reapply the guarded-fetch policy, allow verified raster image types only, reject SVG in v1, cap icons at 512 KiB and previews at 5 MiB, cap decoded dimensions, and maintain an evictable on-disk cache.

**Rationale**: Direct remote images leak user IP/referrer information, make content policies broad, and allow publisher-controlled browser requests. An owned proxy provides a stable same-origin presentation boundary. Cached icons and preview images are metadata presentation assets, not saved page copies.

**Alternatives considered**: Direct image URLs are simpler but less private and safe. Permanently storing every image would create unbounded storage and blur the explicitly deferred offline-snapshot scope.

**Sources**: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## Decision 8: Markdown source with constrained rendering

**Decision**: Store personal notes as Markdown source, derive plain visible text for FTS indexing, and render with react-markdown plus rehype-sanitize. Raw HTML stays disabled; only the specified headings, paragraphs, lists, links, and emphasis are enabled; external links use safe schemes and `noopener noreferrer`.

**Rationale**: Markdown gives the requested readable structure while retaining portable source and a narrow safe-rendering surface.

**Alternatives considered**: Rich-text HTML requires a larger editor and sanitizer contract. Plain text cannot meet the formatting requirement.

**Sources**: [react-markdown](https://github.com/remarkjs/react-markdown), [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize), [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## Decision 9: User-scoped cookie sessions

**Decision**: Provide sign-in/sign-out for pre-provisioned accounts using Argon2id password hashes and an encrypted, same-origin, HTTP-only session cookie containing only the user ID and session metadata. Protect state-changing requests with CSRF tokens. Require `user_id` in every repository call, join, and uniqueness constraint.

**Rationale**: The spec assumes authentication but requires private per-user data. A narrow session boundary satisfies privacy and reviewability without expanding into registration or account recovery.

**Alternatives considered**: A hard-coded user would not prove tenant isolation. Full account lifecycle or third-party identity is outside the approved feature.

**Sources**: [Fastify secure-session](https://github.com/fastify/fastify-secure-session), [Fastify CSRF protection](https://github.com/fastify/csrf-protection)

## Decision 10: Revision-bound bulk confirmation

**Decision**: Maintain a per-user `library_revision` incremented by every mutation that can change query membership. Bulk preview returns the normalized selection, criteria hash, revision, and exact count. Execute uses `BEGIN IMMEDIATE`, verifies the hash/revision/count, materializes targets once, preclassifies invalid items, mutates valid items, and reports exact success/failure IDs and counts. A stale preview returns a conflict and requires fresh confirmation.

**Rationale**: Re-running a changing “all matches” query after confirmation could affect unseen records. The revision gate binds the destructive action to the scope the user reviewed.

**Alternatives considered**: Sending every matching ID to the browser creates oversized requests and stale ownership data. Re-running without a revision check violates the exact-impact promise.

**Sources**: [SQLite transactions](https://www.sqlite.org/lang_transaction.html), [SQLite WAL](https://www.sqlite.org/wal.html)

## Decision 11: Versioned, live saved views

**Decision**: Persist the editable query text, versioned canonical AST with stable tag IDs, structured filters, location, and sort—not result IDs. On open, validate referenced labels. Renames keep stable IDs; deleted references yield an explicit unavailable-criterion warning and never broaden results silently.

**Rationale**: Structured, versioned criteria preserve both faithful editing and predictable evolution of the search grammar.

**Alternatives considered**: Saving only raw strings breaks on label renames. Saving result IDs produces stale snapshots rather than live views.

## Decision 12: Layered verification and runtime

**Decision**: Use Vitest for pure logic and service tests, Fastify `inject()` with temporary databases for API integration, React Testing Library for UI behavior, and Playwright 1.61.0 for end-to-end acceptance. Build before review, start with `npm start`, bind `0.0.0.0:4000`, and add `data-harness-ready="true"` only after session and initial library state resolve.

**Rationale**: Search parsing, tenant isolation, metadata safety, and bulk consistency need fast focused tests, while the approved user journeys need browser-level proof. Playwright is pinned to the installed browser revision.

**Alternatives considered**: Browser-only testing would be slow and poor at security edge cases. Unit-only testing would not validate contracts or integrated user flows.

**Sources**: [Fastify testing](https://fastify.dev/docs/latest/Guides/Testing/), [Vitest guide](https://vitest.dev/guide/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), [Playwright web server](https://playwright.dev/docs/test-webserver)
