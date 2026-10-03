# Technical Research: Personal Bookmark Manager

## Decision 1: One TypeScript application and one server process

**Decision**: Use Node.js 24 LTS with strict TypeScript, React and Vite for the client, and Express for a same-origin REST API and production static hosting. Keep a single npm package and lockfile. The production command starts one Express process on `0.0.0.0:4000`.

**Rationale**: The product is a focused single-user web app, but metadata retrieval must occur on a server because arbitrary destination pages are not reliably browser-accessible and must be governed by SSRF controls. A single process keeps installation, persistence, review, and deployment simple while preserving a hard client/server boundary.

**Alternatives considered**:

- **Browser-only application with IndexedDB**: rejected because browser CORS prevents reliable metadata retrieval and offers no trusted network-policy boundary.
- **Next.js or another SSR framework**: rejected because server rendering, server components, and framework routing do not add value to this one-screen local application.
- **Separate client and API packages/services**: rejected because two deployments and duplicated configuration are unnecessary for one installation.

**Primary references**: [Node.js releases](https://nodejs.org/en/about/previous-releases), [Vite production build guidance](https://vite.dev/guide/build), [Express static files](https://expressjs.com/en/starter/static-files.html)

## Decision 2: SQLite with explicit repositories and migrations

**Decision**: Persist bookmarks, tags, relationships, and cached favicon bytes in SQLite through better-sqlite3. Enable foreign keys and WAL mode; check SQL migrations into source control; place all access behind repository methods and transactions.

**Rationale**: SQLite is durable, transactional, locally deployable, and well matched to a single user and 5,000-row target. better-sqlite3 supports Node 24 and avoids relying on the still-release-candidate `node:sqlite` API. Direct SQL keeps normalization, uniqueness, Boolean search compilation, and migration behavior visible.

**Alternatives considered**:

- **Node built-in SQLite**: rejected for this release because Node 24 documentation still marks it as release-candidate stability.
- **PostgreSQL**: rejected because a separate database service is operationally excessive for one local installation.
- **ORM**: rejected because custom search predicates, migrations, and relationship transactions are clearer in direct SQL at this scale.

**Primary references**: [Node 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [better-sqlite3 project](https://github.com/WiseLibs/better-sqlite3), [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html), [SQLite WAL](https://www.sqlite.org/wal.html)

## Decision 3: Custom search parser with parameterized substring predicates

**Decision**: Implement a small dependency-free lexer and recursive-descent parser for terms, phrases, hashtags, parentheses, implicit/explicit `AND`, `OR`, and unary `NOT`. Compile its AST to fully parameterized predicates over Unicode-normalized search shadow columns and tag relationships.

**Rationale**: This exactly preserves the approved grammar and case-insensitive substring behavior. Search errors can retain source spans for actionable feedback, and no user token is interpolated into SQL. Scanning at most 5,000 compact records is comfortably within the two-second outcome and can be verified by a deterministic performance fixture.

**Alternatives considered**:

- **Pass user syntax to SQLite FTS5**: rejected because FTS5 has different token, phrase, short-pattern, URL-punctuation, and `NOT` semantics; it would silently alter the approved behavior.
- **External search service**: rejected because it introduces another process and synchronization problem for a small local collection.
- **Third-party query parser**: rejected because the grammar is small and a dedicated parser gives exact offsets, limits, and semantics without adapting a broader language.

**Primary references**: [SQLite expression parameters](https://www.sqlite.org/lang_expr.html), [SQLite FTS5 behavior](https://www.sqlite.org/fts5.html)

## Decision 4: Application-owned Unicode normalization

**Decision**: Normalize search values with Unicode NFKC and consistent lowercase conversion in application code, then persist shadow fields updated in the same transaction as source values. Tag identity additionally trims and collapses whitespace. Do not add accent folding unless later specified.

**Rationale**: SQLite's built-in `NOCASE` behavior is ASCII-focused. One shared normalization function gives client validation, repository constraints, tag suggestions, and search matching identical behavior for non-English text.

**Alternatives considered**:

- **SQLite `NOCASE` only**: rejected because it does not meet the specification's case-insensitive non-English behavior.
- **Accent-insensitive matching**: deferred because it changes identity and matching semantics that the approved specification did not request.

## Decision 5: Hardened server-side metadata boundary

**Decision**: Route every page and favicon request through one `MetadataFetcher`. Accept only credential-free public `http`/`https` URLs on ports 80/443. Reject IP literals and special-use hosts, resolve all A/AAAA answers, reject any special/non-public address, pin the validated address to the socket, verify the peer, and repeat the entire process for every manual redirect and favicon request. Apply network egress blocking as defense in depth.

**Rationale**: Fetching a user-supplied address is an SSRF capability. Syntax checking or blocking only RFC1918 addresses is insufficient against IPv6, metadata ranges, redirects, mixed DNS answers, and DNS rebinding. Validation and connection must be a single controlled operation with no ambient credentials.

**Alternatives considered**:

- **Browser fetch**: rejected due to CORS, inconsistent behavior, and absence of a central safety boundary.
- **Validate once and use normal automatic redirects**: rejected because every redirect can change the trust boundary.
- **Allow arbitrary ports**: rejected for the first release because normal public webpage behavior is satisfied by 80/443 while arbitrary ports enlarge the scanning surface.

**Primary references**: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry/), [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry/), [IANA special-use domain names](https://www.iana.org/assignments/special-use-domain-names/), [RFC 9110 redirects](https://www.rfc-editor.org/rfc/rfc9110.html)

## Decision 6: Bounded inert HTML parsing and deterministic fallbacks

**Decision**: Limit the whole HTML operation to eight seconds, five redirects, one MiB of decoded HTML, and a successful `text/html` response. Decode with standards-aware charset handling and parse inertly without executing scripts or loading subresources. Prefer HTML `<title>`, then Open Graph/Twitter title; prefer standard description, then Open Graph/Twitter description. Normalize and cap plain text. Use the normalized hostname as title fallback and leave description empty when unavailable.

**Rationale**: Resource limits prevent slow or oversized destinations from monopolizing the app. Deterministic precedence makes extraction testable. Plain-text output and inert parsing prevent destination markup from becoming application markup. Soft network/content failures still allow saving, as required.

**Alternatives considered**:

- **Open Graph first**: rejected because HTML defines `<title>` specifically for identifying documents in bookmarks and history; social-card values remain fallbacks.
- **Parse any content type by sniffing**: rejected because it expands the parser surface without first-release value.
- **Retry interactively**: rejected because it can delay saving and amplify requests; the user can explicitly retry later.

**Primary references**: [WHATWG HTML parsing and encoding](https://html.spec.whatwg.org/multipage/parsing.html), [WHATWG document title semantics](https://html.spec.whatwg.org/dev/semantics.html), [Open Graph protocol](https://ogp.me/), [RFC 9110 Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html)

## Decision 7: Cache a validated favicon as an app-owned asset

**Decision**: Select one declared icon candidate, then Apple touch icon, then `/favicon.ico`. Fetch it through the same guarded network path, cap decoded bytes at 256 KiB, verify a supported PNG/JPEG/GIF/WebP/ICO signature, reject SVG/HTML, and persist the bytes as an internal icon asset. Serve it with a fixed verified content type and `nosniff`; otherwise use a deterministic app-generated placeholder.

**Rationale**: Loading a remote favicon in the user's browser leaks viewing activity and bypasses the fetch policy. Caching a small verified raster/ICO asset makes saved presentation durable and avoids active-content icon formats.

**Alternatives considered**:

- **Store and hotlink the icon URL**: rejected due to tracking, later breakage, and policy bypass.
- **Accept SVG**: deferred because SVG adds an active-content and parser surface unnecessary for the first release.

**Primary reference**: [WHATWG link and icon semantics](https://html.spec.whatwg.org/multipage/links.html)

## Decision 8: Layered test and accessibility strategy

**Decision**: Use Vitest for pure/server/component tests, Supertest against temporary databases for API integration, and the environment-pinned Playwright 1.61.0 for end-to-end flows. Add axe-core checks plus explicit keyboard-only journeys and semantic ARIA behavior for the tag combobox and dialogs.

**Rationale**: Parser, normalization, extraction, and repository rules are fastest and most exhaustive as unit/integration tests; only a browser can prove focus behavior, keyboard operation, view-state retention, and complete user journeys. Automated accessibility analysis is useful but cannot replace manual interaction assertions.

**Alternatives considered**:

- **End-to-end tests only**: rejected because security and parser edge matrices would be slow and difficult to diagnose.
- **Automated accessibility checks only**: rejected because they do not detect every keyboard, focus, or semantic usability problem.

**Primary reference**: [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)

## Resolved Unknowns

All Technical Context unknowns are resolved, with no open technical questions. Exact dependency pins will be recorded in `package.json` and `package-lock.json`; the implementation remains constrained by the approved specification and the contracts in this feature directory.
