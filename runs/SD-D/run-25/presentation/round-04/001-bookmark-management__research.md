# Research: Bookmark Management

## Decision 1: One Next.js application on Node.js 24 LTS

**Decision**: Use Next.js 16 App Router with React 19 and TypeScript on Node.js 24 LTS, deployed as one Node server.

**Rationale**: The application needs server rendering, authenticated pages, server-only network access, and JSON endpoints. One deployment avoids CORS, duplicated routing, and separate frontend/backend operations while retaining server/client component boundaries. Node 24 is available in the target environment and is an LTS release; Next.js 16 supports Node 20.9 and newer.

**Alternatives considered**:

- Separate SPA and API: rejected because it adds a second build/deployment and cross-origin authentication surface without an approved requirement that needs it.
- Static-only application: rejected because metadata retrieval, authentication, private persistence, and server-enforced authorization require a server.

**Sources**: [Node.js releases](https://nodejs.org/en/about/previous-releases), [Next.js 16 requirements](https://nextjs.org/docs/app/guides/upgrading/version-16), [Next.js Node deployment](https://nextjs.org/docs/app/getting-started/deploying)

## Decision 2: SQLite for the initial single-instance release

**Decision**: Use SQLite through `better-sqlite3` and Drizzle, with WAL mode, foreign keys, a busy timeout, short transactions, and checked-in migrations.

**Rationale**: The approved target is 10,000 bookmarks per user and the initial runtime is one application process. SQLite removes an external-service dependency and supports this read-heavy scale. `better-sqlite3` is selected instead of Node's built-in SQLite module because the Node 24 documentation still marks `node:sqlite` as release candidate. A repository boundary contains database-specific behavior.

**Alternatives considered**:

- PostgreSQL: the better choice for horizontal scaling, sustained concurrent writers, or database-enforced row-level security, but it adds a service and deployment dependency not justified by the approved first-release scale. Revisit when those triggers exist.
- `node:sqlite`: attractive for zero additional driver dependency, but deferred until its API is stable.

**Sources**: [SQLite appropriate uses](https://sqlite.org/whentouse.html), [SQLite WAL](https://sqlite.org/wal.html), [SQLite foreign keys](https://sqlite.org/foreignkeys.html), [Node SQLite status](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [Drizzle SQLite drivers](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)

## Decision 3: Better Auth with a replaceable email boundary

**Decision**: Use Better Auth's email/password, database-session, email-verification, and password-reset flows through its Drizzle adapter. Configure Argon2id password hashing, session revocation after reset, generic recovery responses, and an `EmailSender` interface.

**Rationale**: Authentication and recovery contain subtle security requirements; a maintained library is safer and smaller than a custom protocol. The email boundary permits SMTP or a provider in production and deterministic capture in local/test environments without coupling the product to one vendor.

**Alternatives considered**:

- Custom authentication: rejected because secure password, session, reset-token, verification, and enumeration behavior would substantially expand risk and scope.
- Hosted identity provider: rejected for the initial release because it introduces an external account/service dependency and can make local review fragile.

**Sources**: [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication), [Better Auth email/password](https://better-auth.com/docs/authentication/email-password), [Better Auth installation and adapters](https://better-auth.com/docs/installation), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP forgot password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

## Decision 4: Conservative URL identity normalization

**Decision**: Store both the user's openable URL and a versioned normalized identity key. Trim whitespace; add `https://` only for an unambiguous host-like input; accept only HTTP(S); reject credentials; normalize scheme/host case, IDNA serialization, default ports, empty root path, dot segments, and safe percent encoding. Preserve path case, meaningful trailing slashes, query content/order, and fragments.

**Rationale**: Conservative syntactic normalization detects obvious equivalents without incorrectly collapsing destinations that can contain different content. The unique `(user_id, normalized_url)` constraint, not a preflight check alone, resolves concurrent duplicate attempts. Archived bookmarks remain subject to the same constraint.

**Alternatives considered**:

- Removing tracking parameters, sorting queries, following redirects, or honoring canonical links: rejected because these transformations can merge semantically distinct user bookmarks.
- Ignoring fragments: rejected because fragments can identify distinct secondary resources within one page.

**Sources**: [WHATWG URL behavior in Node](https://nodejs.org/api/url.html), [RFC 3986 normalization and fragments](https://www.rfc-editor.org/rfc/rfc3986.html)

## Decision 5: Custom search parser backed by SQLite FTS5

**Decision**: Implement a bounded lexer/parser for terms, quoted phrases, `tag:` qualifiers, unary `NOT`, `AND`, implicit adjacency, `OR`, and parentheses. Compile its typed syntax tree into parameterized owner/view-scoped SQL using FTS5 for content and relational predicates for tags.

**Rationale**: Passing raw text to an engine query language would leak engine-specific syntax, fail to provide the approved grammar consistently, and make useful position-aware errors difficult. A parser also implements unary `NOT`, which differs from FTS5's binary `NOT`. FTS5 supplies efficient token and phrase lookup for the approved scale.

**Alternatives considered**:

- Direct FTS5 query passthrough: rejected for safety, inconsistent semantics, and poor error control.
- Application-memory scanning: rejected because it gives up indexing and predictable performance.
- PostgreSQL full-text search: capable and preferred if the database migration trigger is reached, but not selected for the initial deployment.

**Sources**: [SQLite FTS5](https://sqlite.org/fts5.html), [PostgreSQL text-search indexes](https://www.postgresql.org/docs/current/textsearch-indexes.html)

## Decision 6: Transactional, explicit-ID bulk operations

**Decision**: The client submits at most 100 explicit selected IDs. The server scopes all IDs to the authenticated owner, applies set-oriented updates in a short transaction, updates the search index in that transaction, and reports succeeded and failed IDs without revealing cross-user ownership.

**Rationale**: Captured IDs ensure the action applies to what the user confirmed even if filters or data change. Expected stale/wrong-state items can be reported individually; an unexpected storage failure rolls back the whole transaction so the app never reports uncertain success. Actions are idempotent where possible.

**Alternatives considered**:

- Re-running a saved search during the mutation: rejected because the result set may have changed and could affect unconfirmed bookmarks.
- One request/transaction per bookmark: rejected because it is slower and can leave harder-to-explain partial state.

**Sources**: [SQLite transactions](https://www.sqlite.org/lang_transaction.html)

## Decision 7: SSRF-resistant metadata retrieval

**Decision**: Put page and icon fetching behind one authenticated server-only client. Resolve and validate all IPv4/IPv6 addresses, reject any non-global destination, pin the connection to a validated address, manually validate every redirect, send no user credentials/cookies, and bound time, redirects, decompressed bytes, rate, and concurrency.

**Rationale**: The URL is attacker-controlled and the product must reach arbitrary public sites, so a domain allowlist is unavailable. DNS checks without connection pinning leave a rebinding window; automatic redirects can bypass an initial check. Static HTML parsing is sufficient and avoids executing untrusted page code.

**Alternatives considered**:

- Browser-side retrieval: rejected because CORS prevents reliable metadata access and it leaks users directly to the destination during capture.
- Headless browser retrieval: rejected because executing page code creates far more cost and attack surface than metadata extraction needs.
- Ordinary fetch after a one-time DNS check: rejected because DNS can change between validation and connection.

**Sources**: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry/), [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry/), [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html), [Cheerio loading](https://cheerio.js.org/docs/basics/loading/)

## Decision 8: Cache only normalized raster icons

**Decision**: Fetch icon candidates through the guarded client, verify actual raster content, cap byte/dimension limits, decode and re-encode the first frame as a small PNG, store it under an application-controlled key, and serve it same-origin with `nosniff`. Reject SVG/XML and fall back to a generated domain icon.

**Rationale**: Browser hotlinking leaks viewer information and leaves content mutable. Trusting MIME alone permits active or malformed content. Re-encoding strips metadata and normalizes the format.

**Alternatives considered**:

- Store or hotlink the original icon: rejected because of privacy, mutability, sniffing, and parser/polyglot risks.
- No icons: rejected because site icons are part of the approved specification.

**Sources**: [OWASP file and image handling](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Fetch `nosniff` integration](https://fetch.spec.whatwg.org/#x-content-type-options-header)

## Decision 9: Markdown source with an allowlisted renderer

**Decision**: Store Markdown source, skip raw HTML, render only approved structural nodes, sanitize the final syntax tree, constrain link protocols to HTTP(S), and generate a separate plain-text projection for search.

**Rationale**: Markdown directly supports the approved headings, emphasis, lists, quotations, links, and code. Storing source keeps notes editable; AST rendering avoids `innerHTML`, and allowlisting prevents active authored content.

**Alternatives considered**:

- Store rich HTML: rejected because safe editing and sanitization become more complex and the spec does not require arbitrary HTML.
- Plain text: rejected because it does not meet the formatting requirement.

**Sources**: [react-markdown security model](https://github.com/remarkjs/react-markdown), [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize), [OWASP XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## Decision 10: Layered web security and owner-scoped access

**Decision**: Use opaque server sessions in HTTP-only SameSite cookies, CSRF tokens plus origin checks on mutations, owner predicates on every data query, generic authentication/recovery responses, secure external-link attributes, CSP, HSTS in production, `nosniff`, frame denial, and private/no-store caching for private responses.

**Rationale**: Cookie attributes are helpful but do not replace CSRF or authorization. Central data-access ownership checks prevent IDOR across normal and bulk paths. Browser headers and safe links contain the impact of rendered or destination content.

**Alternatives considered**:

- Local-storage bearer tokens: rejected because script access increases credential theft exposure.
- SameSite cookies alone for CSRF: rejected because defense in depth is required for authenticated destructive operations.
- UI-only ownership checks: rejected because IDs and requests are attacker-controlled.

**Sources**: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html), [WHATWG `noopener`](https://html.spec.whatwg.org/dev/links.html#link-type-noopener), [W3C Referrer Policy](https://www.w3.org/TR/referrer-policy/)

## Decision 11: Test at domain, database, contract, browser, security, and performance levels

**Decision**: Use Vitest for pure/domain tests, React Testing Library for components, temporary migrated SQLite databases for integration/contract tests, and Playwright 1.61.0 for end-to-end and accessibility tests. Add purpose-built SSRF fixtures and seeded 10,000-item/100-item performance scenarios.

**Rationale**: The main risks cross boundaries: uniqueness and FTS consistency require a real database; ownership and recovery require integrated requests; interaction and persistence require a browser; URL fetching needs hostile network fixtures. Playwright is pinned to match the installed browser revision.

**Alternatives considered**:

- Mock-only database/network testing: rejected because it cannot prove constraints, transactions, FTS behavior, redirect safety, or browser flows.
- End-to-end tests only: rejected because parser and normalization edge cases need fast exhaustive unit coverage.

**Sources**: [Vitest guide](https://vitest.dev/guide/), [Testing Library principles](https://testing-library.com/docs/react-testing-library/intro/), [Playwright web server](https://playwright.dev/docs/test-webserver), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)

## Resolved Technical Limits

These are engineering choices to validate and tune, not limits mandated by the cited sources:

| Concern | Initial limit |
|---|---:|
| URL | 4,096 characters |
| Title | 500 characters |
| Page description | 2,000 characters |
| Personal note | 50,000 characters |
| Tag name | 64 characters |
| Tags per bookmark | 50 |
| Bulk IDs | 100 |
| Search query | 1,000 characters, 100 tokens, 10 nesting levels |
| Metadata redirects | 5 |
| Metadata wall-clock time | 5 seconds |
| Decompressed HTML | 2 MiB |
| Icon input | 256 KiB and 512×512 pixels |
