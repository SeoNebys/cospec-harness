# Research: Bookmark Manager

**Date**: 2026-09-25  
**Status**: Complete — all technical clarifications resolved

## 1. Runtime and application shape

**Decision**: Use Node.js 24 LTS with TypeScript in a single deployable process. Fastify 5 hosts the JSON API and serves a React 19.3 client built by Vite 8.3.

**Rationale**: The feature needs both a browser UI and a trusted server boundary for metadata retrieval. A single TypeScript package keeps shared schemas and types close, avoids cross-service operations for a single-user product, and can satisfy the required `npm start`/port-4000 runtime. Node 24 is an LTS line through April 2028. Fastify 5 supports Node 20+, and Vite's current supported line is 8.3, so all chosen components fit the provided Node 24 environment. Sources: [Node release schedule](https://nodejs.org/en/about/previous-releases), [Fastify v5 compatibility](https://fastify.dev/docs/v5.8.x/Guides/Migration-Guide-V5/), [Vite supported releases](https://vite.dev/releases), [React versions](https://react.dev/versions).

**Alternatives considered**:

- Next.js: rejected because server components, routing conventions, and deployment machinery add little value to a local single-user SPA plus API and widen the security surface.
- Separate frontend and backend projects: rejected because there is only one runtime and no independent deployment need.
- Browser-only storage: rejected because safe metadata retrieval cannot be delegated to the browser and browser storage does not meet the intended durable 10,000-item library well.

## 2. Persistence and full-text search

**Decision**: Use `better-sqlite3` 13.x, which currently bundles SQLite 3.53+, with foreign keys, `journal_mode=WAL`, defensive parameterized access, migrations, and FTS5. Keep one application database connection and a bounded write transaction per mutation.

**Rationale**: SQLite matches the approved one-user/one-device scope and avoids an external service. FTS5 natively supports phrases and Boolean full-text expressions, while WAL lets readers proceed alongside a writer. `better-sqlite3` 13 uses N-API prebuilds and its current release bundles SQLite 3.53.4, beyond the WAL-reset fix in SQLite 3.51.3. Sources: [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases), [SQLite FTS5](https://www.sqlite.org/fts5.html), [SQLite WAL](https://www.sqlite.org/wal.html).

**Alternatives considered**:

- Node's built-in `node:sqlite`: attractive for reducing dependencies, but the Node 24 API is still marked release candidate rather than stable.
- PostgreSQL: capable but operationally disproportionate for one local user and an expected 10,000 records.
- Plain `LIKE` scans: simpler but weaker for phrase tokenization and less predictable at the target scale.

## 3. Search language

**Decision**: Implement an application-owned tokenizer and recursive-descent parser for terms, phrases, exact `#tag` leaves, unary `NOT`, binary `AND`/`OR`, parentheses, and implicit `AND`. Compile the AST into parameterized SQLite row-id set operations; do not forward the raw user query to FTS5 or SQL.

**Rationale**: The product grammar intentionally differs from FTS5: it includes exact tag leaves and unary `NOT`, and it promises case-insensitive operators and useful syntax offsets. Owning the small grammar makes precedence deterministic, allows friendly errors, and prevents query-language injection. FTS5 remains the text-leaf engine and preserves efficient phrase matching. The definitive behavior is in [contracts/search-grammar.md](./contracts/search-grammar.md).

**Alternatives considered**:

- Passing raw input to FTS5: rejected because FTS5's grammar and error messages do not exactly match the approved product behavior.
- Evaluating the entire query in JavaScript: rejected because it would load excessive rows and weaken the one-second goal.
- Adding a search server: rejected at this scale.

## 4. Safe metadata retrieval

**Decision**: Build a restricted fetch transport with Undici 7 and Node DNS primitives. Accept only HTTP(S); reject URL credentials; resolve all A/AAAA records; reject loopback, private, link-local, multicast, documentation, reserved, and otherwise non-global addresses; pin the validated address for the actual connection; follow redirects manually up to five hops with full revalidation; use a shared 8-second network budget within a 10-second request budget; cap markup at 2 MiB and each image at 2 MiB; accept only declared HTML/XHTML for page parsing and raster/ICO image types for assets.

**Rationale**: Fetching a user-supplied URL is an SSRF boundary. OWASP recommends checking IPv4 and IPv6 results, defending against DNS pinning, and not following redirects without revalidation. Cheerio likewise warns that URL input must be validated and response size bounded. Installing Undici 7 matches Node 24's support line and provides the transport hooks needed to pin validated resolution. Sources: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Cheerio security](https://cheerio.js.org/docs/advanced/security/), [Undici compatibility](https://undici.nodejs.org/).

**Additional controls**:

- Do not send browser cookies, authorization headers, or referrers.
- Use a clear application user-agent and conservative accept headers.
- Abort on byte limit rather than buffering an unbounded body.
- Never execute scripts or use a headless browser to obtain metadata.
- Revalidate and safely fetch candidate icon/image URLs independently; never expose an unchecked proxy endpoint.
- Store accepted media by content hash under `data/assets`; serve it with a fixed content type, `nosniff`, and restrictive content security policy.
- Generate a hostname/path title and a partial/failed warning for any recoverable failure.

**Alternatives considered**:

- Client-side fetching: rejected because CORS makes it unreliable and it does not create a safe, consistent boundary.
- Cheerio `fromURL()` directly: rejected because application-controlled DNS pinning and per-redirect checks must happen before parsing.
- Browser automation: rejected because it executes untrusted page code, costs more, and is unnecessary for standard page metadata.

## 5. Metadata extraction and preview media

**Decision**: Parse bounded response bytes with Cheerio 1 using encoding sniffing. Select title, description, icon, and image through a documented priority order: Open Graph, Twitter card, standard page metadata, then deterministic URL fallback. Cache only verified icon/preview image bytes, not page content.

**Rationale**: Cheerio parses HTML without executing scripts and can decode raw buffers using document encoding hints. Structured fallbacks cover common pages while keeping the feature best-effort. Local media caching prevents remote tracking when the library is viewed and makes the captured preview more durable without becoming an offline page archive. Sources: [Cheerio loading documents](https://cheerio.js.org/docs/basics/loading/), [Cheerio security](https://cheerio.js.org/docs/advanced/security/).

**Priority rules**:

- Title: `og:title` → `twitter:title` → `<title>` → hostname plus meaningful final path segment.
- Description: `og:description` → `twitter:description` → `<meta name="description">`.
- Preview image: `og:image` → `twitter:image`.
- Site icon: largest suitable declared icon → standard icon declarations → `/favicon.ico` candidate.
- Resolve relative candidates against the final response URL, but keep the user's original normalized bookmark URL as the duplicate key.

**Alternatives considered**:

- Store external media URLs only: rejected because loading them leaks library-view activity and breaks whenever the remote asset changes.
- Save rendered screenshots or whole pages: rejected because offline copies and screenshots are explicitly deferred.

## 6. Rich-note representation

**Decision**: Use Tiptap 3 with a deliberately reduced extension set and store validated JSON plus derived plain text. Permit paragraph/text, bold, italic, bullet list, ordered list, list item, and HTTP(S) link only. Render the validated document structure; never persist or inject arbitrary note HTML.

**Rationale**: Tiptap's maintained starter extensions include the requested formatting primitives, while JSON provides a strict server-validation boundary and reliable plain-text extraction for search. The server can reject unknown nodes, disallowed link protocols, and documents over 5,000 readable characters. Source: [Tiptap StarterKit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit).

**Alternatives considered**:

- Markdown: compact, but the approved experience asks users to apply formatting and see it rendered rather than work with notation.
- Raw HTML: rejected because sanitization and stable editing become harder.
- Plain `contenteditable`: rejected because list behavior, selection state, keyboard handling, and serialization would require recreating editor infrastructure.

## 7. Validation, contracts, and API boundary

**Decision**: Define the HTTP API in OpenAPI 3.1 and mirror request/response schemas in shared Zod schemas. Fastify performs validation at ingress and response serialization. Database operations use prepared statements only. Keep the API same-origin and do not enable CORS.

**Rationale**: A written contract lets client, server, integration tests, and error states agree before implementation. Shared runtime schemas prevent TypeScript-only assumptions from becoming trust boundaries. Same-origin delivery is sufficient for the approved single application.

**Alternatives considered**:

- GraphQL: rejected because the bounded resource/action model does not need query composition machinery.
- Server actions only: rejected because explicit HTTP contracts are easier to integration-test and keep framework-independent.

## 8. Testing and accessibility

**Decision**: Use Vitest 5 for pure logic and client component tests, Fastify injection with temporary databases for server integration, and Playwright 1.61.0 for end-to-end workflows. Add `@axe-core/playwright` scans but pair them with explicit keyboard, focus, accessible-name, live-status, and dialog tests. Seed 10,000 deterministic bookmarks for performance checks.

**Rationale**: Vitest 5 supports Node 24 and Vite 8. Playwright is already installed in the runtime at 1.61.0, so pinning that version avoids a browser-revision mismatch. Playwright's own guidance states that automated accessibility scans catch only some issues and should be combined with manual/interaction checks. Sources: [Vitest 5](https://vitest.dev/blog/vitest-5), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).

**Test seams**:

- Inject the outbound metadata transport so tests use deterministic fixtures without granting localhost as a production-safe destination.
- Use a fresh temporary SQLite file per integration suite and run real migrations.
- Test the search parser with table-driven valid and invalid queries plus precedence/property cases.
- Test bulk actions for all-valid, mixed-validity, and rollback-worthy failures.
- Measure metadata, search, sorting, and 100-item bulk goals separately from functional assertions.

**Alternatives considered**:

- End-to-end tests only: rejected because parser, SSRF, normalization, and transaction edge cases need focused feedback.
- Automated accessibility scans alone: rejected because they cannot verify complete keyboard workflows or every semantic barrier.

## 9. Deferred capabilities

**Decision**: Do not create tables, endpoints, or UI placeholders for offline page copies, saved searches, browser import/export, accounts, sync, sharing, folders, favorites, or custom drag ordering in this release.

**Rationale**: Recording speculative structures would complicate migrations and blur the approved release boundary. The current normalized bookmark/tag model can be extended later without pretending deferred behavior exists now.
