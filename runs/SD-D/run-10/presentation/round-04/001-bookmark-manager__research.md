# Research and Technical Decisions: Bookmark Manager

**Date**: 2026-09-18  
**Status**: Complete — no unresolved technical clarifications

## 1. Runtime and Deployment Shape

**Decision**: Use Node.js 24 LTS and TypeScript 5.9 in one deployable service. Fastify 5.12 serves a React 19.3 application built by Vite 8 and owns the same-origin JSON API.

**Rationale**: Node 24 is the LTS line already supplied by the project environment and remains supported through April 2028. Fastify 5 supports Node 20+ and provides schema-driven request handling, injection-based testing, logging, and a small server footprint. A same-origin client/API removes cross-origin cookie configuration and makes the required `npm start` deployment a single foreground process.

**Alternatives considered**:

- Next.js: capable, but server rendering is not required for this private application and its deployment/runtime conventions add unnecessary surface area.
- Separate frontend and API services: rejected because it adds deployment, CORS, cookie, and local-review complexity without a v1 requirement.
- Node 26 Current: rejected in favor of the longer-established LTS line available in the runtime image.

**Sources**: [Node.js release schedule](https://nodejs.org/en/about/previous-releases), [Fastify v5 support](https://fastify.dev/docs/v5.0.x/Guides/Migration-Guide-V5/), [Vite guide](https://vite.dev/guide/), [React versions](https://react.dev/versions)

## 2. Relational Storage and Full-Text Index

**Decision**: Use SQLite with `better-sqlite3` 13, WAL mode, foreign keys enabled, explicit SQL migrations, and an FTS5 virtual table maintained transactionally by repository services.

**Rationale**: The first-release scale is a read-heavy, single-instance application with 10,000 bookmarks per personal library. SQLite provides transactions, unique/foreign-key constraints, and FTS5 phrase and Boolean primitives without an external service. `better-sqlite3` is tested against Node 24 and exposes straightforward prepared statements and transactions. Handwritten SQL keeps the FTS5 and recursive search predicates visible; Zod and repository return types provide boundary validation.

**Alternatives considered**:

- PostgreSQL: a strong future option for horizontal scale, but it adds an external service and operational burden not justified for the approved single-instance v1.
- `node:sqlite`: reduces dependencies, but the Node 24 API is still marked release candidate rather than stable.
- Drizzle ORM: useful for ordinary relational queries, but current documentation does not natively model SQLite extensions; direct SQL is clearer for FTS5 and transactional index maintenance.

**Sources**: [SQLite FTS5](https://www.sqlite.org/fts5.html), [`better-sqlite3` project](https://github.com/WiseLibs/better-sqlite3), [Node 24 SQLite status](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [Drizzle SQLite extensions](https://orm.drizzle.team/docs/sqlite/extensions)

## 3. User Search Language

**Decision**: Implement a dedicated lexer and recursive-descent parser for words, quoted phrases, `#tag`, `NOT`, `AND`, and `OR`. Adjacent operands become `AND`; precedence is `NOT` > `AND` > `OR`. The parser emits an application-owned AST that compiles to parameterized SQL predicates.

**Rationale**: The approved grammar differs from raw FTS5 syntax and mixes full-text terms with exact relational tags. Parsing first provides precise error positions, prevents query injection, supports the promised precedence, and lets tag and full-text predicates participate in one Boolean expression. FTS5 handles tokenization and phrase matching after the application quotes and parameterizes each leaf.

**Alternatives considered**:

- Passing raw input to FTS5: rejected because SQLite's grammar and errors would leak through, `#tag` is not a relational tag operator, and raw syntax is unsafe and inconsistent with the approved contract.
- Client-only filtering: rejected because it cannot meet the 10,000-item target reliably and would expose excessive private data to the browser.
- Third-party hosted search: rejected because it adds cost, privacy, synchronization, and deployment complexity at this scale.

**Source**: [SQLite FTS5 query and phrase syntax](https://www.sqlite.org/fts5.html)

## 4. Page Metadata Extraction

**Decision**: Fetch metadata on the server. Parse HTML with Cheerio and use this precedence:

1. Title: `og:title`, then `twitter:title`, then document `<title>`, then destination host.
2. Short description: `og:description`, then `twitter:description`, then `<meta name="description">`.
3. Preview image: `og:image` (including secure URL variants), then `twitter:image`.
4. Site icon: valid `<link rel>` icon candidates, then a same-origin `/favicon.ico` attempt.

Resolve relative candidate URLs against the final permitted response URL. Return field-level provenance and warnings so the client can distinguish fetched values, fallbacks, missing fields, and user edits.

**Rationale**: Open Graph explicitly defines title, image, URL, and description for rich page representations. Fallbacks cover pages using Twitter cards or standard HTML only. Server retrieval avoids browser CORS failures and allows consistent limits and security checks.

**Alternatives considered**:

- Browser-side scraping: rejected because cross-origin browser rules prevent dependable retrieval.
- Headless browser rendering for every capture: deferred because it is expensive and creates a much larger attack surface; static metadata handles the representative first-release case.
- Requiring metadata success before save: rejected by the approved failure-tolerant workflow.

**Source**: [Open Graph protocol](https://ogp.me/)

## 5. SSRF and Remote Media Controls

**Decision**: Treat every page, redirect, icon, and preview image URL as untrusted. Allow only HTTP(S); reject embedded credentials and nonstandard ports by default; resolve all A/AAAA answers; block loopback, private, link-local, multicast, unspecified, documentation, and other non-public ranges; revalidate every redirect hop; disable automatic redirects; cap redirect count, connect/total time, compressed and expanded body sizes; accept HTML for page parsing and allowlisted image MIME types for media; never forward user cookies or authorization headers.

**Rationale**: Metadata capture is an intentional server-side request to a user-controlled URL, the classic open-destination SSRF case. DNS and redirect revalidation are necessary because an initially public-looking hostname can resolve or redirect to internal infrastructure.

**Alternatives considered**:

- Simple hostname denylist: rejected because alternate IP forms, IPv6, DNS rebinding, and redirects can bypass string checks.
- General outbound proxy endpoint: rejected; only the bounded metadata/media service receives outbound access.
- Storing only third-party image URLs: rejected because it leaks the viewer's request to the third party and makes visuals unstable. Selected visuals are fetched, validated, and served as authenticated app-owned assets.

**Source**: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## 6. Authentication, Sessions, and Recovery

**Decision**: Use email/password accounts with Argon2id hashes. Generate high-entropy opaque session tokens, store only their hashes, rotate on authentication, and deliver them via `HttpOnly`, host-only, `SameSite=Lax`, `Secure`-in-production cookies. Require a session-bound CSRF header plus Origin/Fetch-Metadata validation for state-changing requests. Store password-reset tokens hashed, single-use, and expiring; route delivery through an SMTP-compatible provider, with a log-only provider restricted to development/test.

**Rationale**: Server-stored sessions are easy to revoke and avoid placing identity or authorization claims in the browser. Argon2id is the current OWASP-recommended password hash. CSRF controls are necessary because the API uses cookies. A mail boundary keeps local verification self-contained without weakening production recovery.

**Alternatives considered**:

- Browser-stored JWTs: rejected because revocation and safe token storage add complexity without a stateless multi-service requirement.
- In-memory sessions: rejected because data must survive restarts and the Fastify session plugin explicitly warns against its default memory store for production.
- Plain reset tokens in the database: rejected because a database leak would immediately expose active reset links.

**Sources**: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [`@fastify/cookie` security guidance](https://github.com/fastify/fastify-cookie)

## 7. Formatted Notes

**Decision**: Store note source as Markdown. Provide toolbar actions and preview for the approved headings, bold, italics, lists, paragraphs, and links. Render with `react-markdown`, raw HTML disabled, a restricted element set, and safe URL transformation; apply `rehype-sanitize` as defense in depth.

**Rationale**: Markdown stores durable plain text, covers the approved formatting set, is searchable after formatting markers are stripped, and avoids a complex rich-text document schema. Disabling raw HTML sharply limits XSS surface.

**Alternatives considered**:

- Arbitrary HTML: rejected because sanitization and future compatibility are harder and scripts/interactive embeds are explicitly out of scope.
- Rich-text JSON editor: rejected because the approved formatting does not justify editor-specific document state.
- Plain text only: rejected because it does not meet the approved formatted-note behavior.

**Sources**: [`react-markdown` security and URL handling](https://github.com/remarkjs/react-markdown), [`rehype-sanitize`](https://github.com/rehypejs/rehype-sanitize)

## 8. Media Asset Lifecycle

**Decision**: Download chosen site icons and preview images to `data/assets/` and describe them in a `media_assets` table. Metadata previews create user-owned draft assets with an expiry. Bookmark create/update promotes referenced drafts to attached assets in the same transaction. Replaced, expired, and unreferenced assets are garbage-collected after a grace period. Media is served only after owner authorization using opaque public IDs, strict content types, and caching headers.

**Rationale**: This prevents tracking through third-party images, makes saved visuals stable, keeps binary data out of SQLite, and supports later replacement/removal. Draft ownership prevents one user from attaching another user's capture.

**Alternatives considered**:

- Binary blobs inside SQLite: workable at small scale, but it enlarges backups and increases database write amplification.
- Public filesystem paths: rejected because they bypass owner authorization.
- Full object storage service: deferred until multi-instance deployment or larger asset volume requires it.

## 9. Concurrency and Bulk Actions

**Decision**: Give bookmarks and saved searches monotonically increasing version numbers. Patch requests include `expectedVersion`; stale writes return `409 Conflict` with the current representation. Bulk operations accept either explicit IDs or a normalized all-matches selection. Destructive/archive previews issue a short-lived, user-bound confirmation token containing the criteria digest and expected count. Execution recalculates eligibility inside one transaction and rejects a changed dynamic count for reconfirmation.

**Rationale**: This meets the no-silent-overwrite requirement and prevents a stale filtered selection from deleting or archiving newly matching items. Transactional execution supports exact success/failure accounting.

**Alternatives considered**:

- Last-write-wins: rejected by FR-044.
- Sending thousands of IDs for all matches: rejected because pagination and changing results would make selection incomplete or stale.
- Background job queue: not required for the approved 1,000-item target; synchronous chunked transactions are simpler and can be revisited if measured limits demand it.

## 10. Test Strategy

**Decision**: Use four layers:

- Node's test runner for parser, URL normalization, SSRF address classification, state transitions, and repository units.
- Fastify injection with temporary SQLite databases/filesystems for API, ownership, transaction, and failure-path integration tests.
- React Testing Library plus Vitest for interactive components and accessibility behavior.
- Playwright 1.61.0 for full user journeys in Chromium at desktop and phone viewports, pinned to match the installed browser revision.

Add seeded 10,000-bookmark search/performance checks and 1,000-item bulk accounting checks. Use controlled local HTTP fixtures for redirects, missing metadata, oversized bodies, invalid MIME types, and timeouts; never depend on arbitrary public sites in automated tests.

**Rationale**: Pure behavior is fastest to prove at unit level, database and server boundaries need real integration tests, and responsive end-to-end scenarios prove the actual user flows and readiness marker.

**Alternatives considered**:

- End-to-end tests only: rejected because failure diagnosis would be slow and security/parser edge cases are easier to exhaust below the browser layer.
- Live public sites in CI: rejected because they are nondeterministic and can change or rate-limit tests.

**Sources**: [Node test runner](https://nodejs.org/api/test.html), [Playwright installation and system support](https://playwright.dev/docs/intro)

## 11. Deferred Evolution

**Decision**: Keep import/export and full-page saved copies outside v1, as approved. Preserve extension seams:

- Bookmark creation runs through one domain service so a future import can reuse normalization, duplicate handling, tag assignment, and index updates.
- Export can read the stable bookmark/tag/collection model without exposing internal row IDs.
- `media_assets` stores only icon/preview purposes; a future content-snapshot entity will be separate so archived-page retention and quotas do not distort bookmark metadata.

**Rationale**: These seams retain the client's roadmap intent without adding unapproved workflows, storage policies, or implementation tasks to v1.
