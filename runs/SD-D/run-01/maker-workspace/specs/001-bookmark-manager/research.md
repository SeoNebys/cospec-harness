# Phase 0 Research: Bookmark Manager

**Date**: 2026-09-16  
**Status**: Complete; no unresolved technical clarifications

## Application Architecture

**Decision**: Build one TypeScript application with a React 19 single-page client, a Fastify 5 service, and shared contract modules. Vite 8 builds the client; Fastify serves both /api/v1/* and the built client from one Node.js 24 process on 0.0.0.0:4000.

**Rationale**: The repository is empty, the product is a responsive web application, and the review environment already provides Node.js 24. A same-origin deployment keeps cookies and browser security policy straightforward, avoids a production CORS boundary, and provides one foreground start command.

**Alternatives considered**:

- Next.js: rejected because server rendering and React Server Components do not add value to the approved workflows and would add framework-specific deployment complexity.
- Separate frontend and backend packages: rejected because the initial product has one team, one deployment, and shared schemas.
- A client-only application: rejected because metadata retrieval, private data, sessions, import validation, and SSRF controls require a trusted server.

**Sources**:

- [React 19.3](https://react.dev/blog/2026/09/09/react-19-3)
- [Vite supported releases](https://vite.dev/releases)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Fastify 5 documentation](https://fastify.dev/docs/v5.12.x/)

## Language, Validation, and Runtime

**Decision**: Use Node.js 24.21, TypeScript 6.0 in strict ESM mode, React Router 8 in declarative SPA mode, and TypeBox-backed JSON Schemas for Fastify request and response validation. Pin dependency major versions and commit the npm lockfile.

**Rationale**: Node 24 is fixed in the runtime; TypeScript 6 is compatible with the current build and validation ecosystem; TypeBox produces standards-based JSON Schema while inferring TypeScript types. Fastify 5 requires full schemas and benefits from one source for runtime validation and route types.

**Alternatives considered**:

- TypeScript 7.0: deferred because its initial native compiler release intentionally omits parts of the compiler API; revisit once the surrounding toolchain supports it without exceptions.
- Hand-maintained TypeScript types plus separate JSON Schemas: rejected because duplicated contracts drift.
- A global state library: rejected for the initial scope; React state/context and URL query parameters are sufficient.

**Sources**:

- [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
- [Fastify type providers](https://fastify.dev/docs/latest/Reference/Type-Providers/)
- [Fastify TypeBox provider](https://github.com/fastify/fastify-type-provider-typebox)

## Persistence

**Decision**: Use SQLite through Node 24's built-in node:sqlite DatabaseSync, parameterized SQL, and ordered SQL migrations. Enable foreign keys, WAL mode, defensive mode, and a busy timeout. Keep all database access in server repository modules and wrap multi-entity changes in transactions.

**Rationale**: The target is a single-node personal bookmark service with at least 1,000 bookmarks per user. Built-in SQLite removes native add-on installation risk and supports transactions, relational tag filtering, and FTS5. The provided Node 24.21 runtime was directly checked and successfully created an FTS5 virtual table.

**Risk**: node:sqlite is release-candidate stability rather than fully stable in Node 24. This is acceptable for the fixed runtime and is isolated behind repository interfaces so it can be replaced if operational evidence requires it.

**Alternatives considered**:

- better-sqlite3: viable fallback, but rejected initially because it adds a native package for an API the fixed runtime already provides.
- PostgreSQL: rejected for this deployment because no external database service is supplied and the expected concurrency does not justify one.
- An ORM: rejected because the schema and queries are bounded, and direct parameterized SQL makes FTS and tag-intersection queries clearer.

**Sources**:

- [Node.js 24 SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html)
- [SQLite WAL](https://www.sqlite.org/wal.html)

## Accounts and Sessions

**Decision**: Provide local email/password accounts as the supporting sign-in capability. Normalize email addresses, derive password hashes asynchronously with Node's crypto.scrypt, and use opaque random session tokens. Store only a token hash in SQLite and send the token in an HttpOnly, SameSite=Lax cookie; use Secure cookies in production HTTPS. Check same-origin Origin/Sec-Fetch-Site on state-changing requests and rotate the session at authentication.

**Rationale**: The approved spec requires private account-scoped collections. Opaque server-side sessions are revocable, work naturally with the same-origin deployment, and avoid adding an authentication framework or bearer tokens to browser storage.

**Alternatives considered**:

- Stateless JWT sessions: rejected because revocation and logout become more complicated without adding user value.
- External OAuth-only login: rejected because it introduces an external service dependency not requested by the client.

**Sources**:

- [Node.js crypto scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Metadata Retrieval and SSRF Boundary

**Decision**: Implement metadata preview as a synchronous, cancellable server operation that completes before bookmark creation but never makes saving depend on success. Use a non-executing HTML parser. Apply a dedicated safe-fetch policy to the page and every icon request:

- Accept absolute HTTP/HTTPS destinations; reject credentials for preview retrieval.
- Save valid public URLs even when preview retrieval is unsupported or fails.
- Permit metadata retrieval only on default ports 80/443 and hostnames resolving entirely to public addresses; IP literals, .localhost, .local, and IANA special-purpose ranges are not fetched.
- Resolve all A/AAAA records, pin the validated address for the actual connection while retaining hostname TLS verification, and repeat validation for every redirect.
- Follow at most five page redirects manually, reject HTTPS-to-HTTP downgrade and redirect cycles, and never forward cookies, authentication, referrers, or client headers.
- Enforce a three-second connect/header budget, eight-second total budget, two-second body-idle budget, 32 KiB header cap, and 1 MiB decoded HTML cap. Accept only successful HTML/XHTML responses.
- Never execute scripts or load page subresources.

**Rationale**: User-supplied URLs make metadata preview an SSRF and resource-exhaustion boundary. Validating DNS and then allowing the HTTP library to resolve again is vulnerable to rebinding, so the validated address must be used for the connection. Failure falls back to the normalized hostname, blank description, and generic icon as the spec requires.

**Metadata precedence**:

- Title: first non-empty Open Graph title, then Twitter title, then document title, then normalized hostname.
- Description: first non-empty Open Graph description, then Twitter description, then HTML description, then blank.
- At a winning tier, the first non-empty value in document order wins.
- Normalize whitespace and control characters; cap title at 300 Unicode code points and description at 1,000.

**Icon decision**: Resolve declared icons against the final page/base URL, validate each icon fetch with the same network policy, and cap it at two redirects, three seconds, and 256 KiB decoded. Accept only verified PNG, JPEG, WebP, GIF, or ICO input. Use Sharp to decode with pixel limits, take the first frame, and store an app-owned PNG no larger than 512×512. Reject SVG and data URLs. The browser loads icons only from this application.

**Alternatives considered**:

- Browser-side retrieval: rejected because CORS makes it unreliable and it exposes the user to tracking.
- Store the remote icon URL: rejected because it leaks the user's IP/referrer, changes over time, and serves untrusted content directly.
- Automatic redirect following: rejected because every hop requires fresh SSRF validation.
- Asynchronous background enrichment: rejected for the initial workflow because the approved spec requires an editable preview before saving; explicit refresh remains available.

**Sources**:

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry)
- [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry)
- [Node.js DNS API](https://nodejs.org/api/dns.html)
- [Open Graph protocol](https://ogp.me/)
- [WHATWG HTML document metadata](https://html.spec.whatwg.org/dev/semantics.html)
- [WHATWG icon link type](https://html.spec.whatwg.org/multipage/links.html#rel-icon)
- [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)

## URL Identity

**Decision**: Preserve the user's submitted URL for opening/export while computing a separate canonical key for duplicate detection. Canonicalization lowercases the scheme and host, removes the fragment, removes default ports, normalizes an empty path to /, and removes a trailing slash only when it is the sole path separator. It does not reorder/drop query parameters or apply site-specific rules. Uniqueness is (user_id, canonical_key) across active and archived bookmarks.

**Rationale**: This covers the explicitly approved duplicate cases without changing destination meaning. Query parameters may be significant, so aggressive “tracking parameter” removal is unsafe.

**Alternatives considered**:

- Use the submitted URL directly: rejected because trivial spelling differences would create duplicates.
- Aggressive URL cleaning: rejected because it can collapse distinct resources.

## Search, Filtering, Sorting, and Tag Suggestions

**Decision**: Use an SQLite FTS5 external-content index over title, URL, description, personal notes, and a denormalized tag-name field. Parse only the approved query grammar: whitespace-separated words and non-empty double-quoted phrases. Escape every atom and join them with explicit AND; raw FTS operators are never passed through. A phrase matches adjacent tokens in one field. Unmatched quotes produce an inline correction.

Tag filters remain relational. Resolve selected tag IDs in the current account and require all with GROUP BY bookmark_id HAVING COUNT(DISTINCT tag_id) = selected_count. Combine FTS, tags, favorite/read-later/archive predicates, and a whitelisted title/date sort in one query. Add bookmark ID as a deterministic tie-breaker.

Tag suggestions query the current user's normalized tag names case-insensitively as text is entered, return a small ranked list with prefix matches first, and rely on a unique (user_id, normalized_name) constraint to prevent case-only duplicates.

**Rationale**: FTS5 natively provides phrases, implicit/explicit AND semantics, Unicode tokenization, and case-independent matching. An application-owned grammar meets the product behavior without exposing a complex query language or accepting query-syntax injection.

**Alternatives considered**:

- SQL LIKE over concatenated fields: workable at 1,000 items, but rejected because exact token-phrase behavior and indexing are clearer with built-in FTS5.
- Expose FTS5 syntax: rejected because the approved product has a deliberately smaller, predictable grammar.

**Sources**:

- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [SQLite aggregate functions](https://www.sqlite.org/lang_aggfunc.html)
- [SQLite SELECT and HAVING](https://www.sqlite.org/lang_select.html)

## Browser Import and Portable Export

**Decision**: Parse Chrome, Edge, Firefox, and Safari bookmark exports as one tolerant Netscape Bookmarks HTML family. Parse the file as inert data, accept only HTTP/HTTPS entries, walk folder nesting, preserve titles and dates, and convert meaningful ancestor folders to tags. Recognize Safari Reading List only when its documented identifier is present; map those entries to unread read-later items.

Import is a two-step preview/commit flow. Preview stores a short-lived parsed snapshot tied to the user and upload digest, reports new/duplicate/invalid counts, and makes no bookmark changes. Commit consumes that exact snapshot, processes valid browser entries without duplicating completed work on retry, and reports per-entry failures. Limits: 10 MiB file, 20,000 links, nesting depth 100, and the normal field/tag limits. Imported pages are not bulk-fetched for metadata.

Offer two exports:

1. **Browser bookmarks (.html)** for cross-browser URL/title/date portability; tags are represented as folders where possible.
2. **Complete backup (.json)** for lossless app restoration, including descriptions, notes, icons, tags, favorite/read-later/read/archive states, and dates.

The complete backup has a named format and integer schema version, contains no account/session/internal IDs, is fully validated before mutation, and restores atomically only into an empty collection.

**Rationale**: Browser HTML is the common interchange family but cannot represent all app state. A separate versioned JSON backup provides honest, testable lossless restoration without ZIP extraction risks.

**Alternatives considered**:

- One HTML export advertised as complete: rejected because it loses notes and app-specific states.
- ZIP plus a manifest and image files: deferred because JSON with bounded base64 icons is sufficient for the initial scale and avoids path traversal/decompression-bomb handling.
- Metadata-fetch every imported URL: rejected because it would turn a 1,000-item import into an unsafe, slow network crawl.

**Sources**:

- [Chrome bookmark import/export](https://support.google.com/chrome/answer/96816)
- [Firefox HTML bookmark export](https://support.mozilla.org/en-US/kb/export-firefox-bookmarks-to-backup-or-transfer)
- [Safari exported data format](https://developer.apple.com/documentation/SafariServices/importing-data-exported-from-safari)
- [JSON, RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)
- [Internet timestamps, RFC 3339](https://www.rfc-editor.org/rfc/rfc3339)

## Testing and Quality Strategy

**Decision**: Use Vitest 5 for unit, repository, parser, service, and component tests; React Testing Library for accessible interaction tests; Fastify inject() with temporary SQLite databases for API integration/contract tests; and Playwright 1.61.0 for built-application acceptance tests. Keep Node and DOM Vitest projects separate. Pin Playwright exactly to the installed browser revision.

Use injected resolver/transport adapters and deterministic fixtures for metadata security tests; automated tests must not rely on arbitrary live websites. Include keyboard-only flows, mobile and desktop viewports, unauthorized cross-account access, import retry, complete restore, and the harness readiness marker.

**Rationale**: This split gives fast deterministic coverage at service boundaries and reserves full browser tests for the approved end-to-end journeys. It also matches the runtime's installed tooling.

**Alternatives considered**:

- Only end-to-end tests: rejected because SSRF, parsing, canonicalization, and database edge cases need precise deterministic fixtures.
- Live-site metadata tests: rejected because they are slow, flaky, and may change or block automation.

**Sources**:

- [Vitest 5](https://vitest.dev/blog/vitest-5)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright web server testing](https://playwright.dev/docs/test-webserver)

