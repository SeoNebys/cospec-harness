# Research: Bookmark Manager

**Date**: 2026-09-24  
**Status**: Complete — all planning unknowns resolved

## 1. Application Architecture

**Decision**: Use Node.js 24 LTS and TypeScript in an npm workspace. Build a React 19 single-page client with Vite, serve it and a JSON API from Fastify 5, and supervise a separate capture child process from the same production bootstrap.

**Rationale**: The product is a single-user local-first web application with server-only network capture, SQLite, files, and durable background work. A SPA plus a small API keeps those responsibilities explicit, supports the required review runtime, and avoids a second deployed service. Fastify supplies schema-based validation, lifecycle hooks, and direct injection testing. Node 24 is available in the runtime and remains an LTS line.

**Alternatives considered**:

- Next.js: rejected because server rendering is not a requirement and its mixed rendering/data conventions add little value to this local application.
- Electron or a native desktop shell: rejected because the requested deliverable is reviewable as an HTTP application and no native integration is required.
- PostgreSQL plus an external queue/object store: rejected because one user and 10,000 bookmarks do not justify external services; it would make offline/local operation harder.

**Primary references**: [Node release schedule](https://nodejs.org/en/about/previous-releases), [Fastify documentation](https://fastify.dev/docs/latest/), [Vite 8 announcement](https://vite.dev/blog/announcing-vite8), [React versions](https://react.dev/versions)

## 2. Structured and Blob Storage

**Decision**: Use better-sqlite3 with SQLite in WAL mode, handwritten versioned SQL migrations, foreign keys, and explicit repository transactions. Store large artifacts outside SQLite in a content-addressed blob tree keyed by SHA-256, with temporary staging and atomic rename.

**Rationale**: SQLite provides transactions, FTS5, reliable local persistence, and ample performance at the approved scale. better-sqlite3 is mature, supports current Node releases and FTS5, and avoids relying on Node 24's still release-candidate `node:sqlite` API. Content-addressed files prevent database bloat, provide integrity checks and deduplication, and allow streaming size enforcement.

**Alternatives considered**:

- Node `node:sqlite`: rejected for initial implementation because Node 24 documentation still marks it Stability 1.2 rather than stable.
- Store pages/PDFs as database BLOBs: rejected because large immutable artifacts would increase database backup, WAL, and vacuum costs.
- Arbitrary per-bookmark file paths: rejected because content hashes simplify integrity validation and safe garbage collection.

**Primary references**: [SQLite WAL](https://sqlite.org/wal.html), [SQLite transactions](https://sqlite.org/lang_transaction.html), [Node 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

## 3. Durable Background Work

**Decision**: Implement a SQLite-backed job/outbox table. Bookmark/import transactions insert capture attempts and jobs atomically. A worker leases jobs with heartbeat/expiry, uses attempt IDs for idempotency, retries only transient failures, and recovers expired leases after restart.

**Rationale**: Captures can take tens of seconds and must not delay bookmark visibility or import completion. A durable local queue prevents lost work without adding Redis. Separate worker concurrency also bounds browser memory and isolates failures from API responsiveness.

**Alternatives considered**:

- In-memory task queue: rejected because jobs would disappear on restart and would race bookmark transaction failures.
- External queue: rejected at single-user scale because it creates another service and backup boundary.
- Capture inside HTTP requests: rejected because it violates the two-second bookmark/status outcome and makes timeout recovery unsafe.

## 4. Metadata and Offline Capture

**Decision**: Use a two-stage pipeline. A policy-enforcing gateway fetches and classifies the main resource. PDFs are stored byte-for-byte. HTML is rendered in a fresh Playwright Chromium context whose traffic is mediated by the same gateway, then reduced to a static sanitized standalone representation with Monolith and validation tooling. Store a manifest alongside the resulting immutable blob references.

**Rationale**: Raw source HTML misses client-rendered content; reader extraction alone loses recognizable layout; screenshots are not readable structured copies. A rendered then static bundle best balances approved fidelity and safe offline reading. Monolith is CC0-licensed and can package page resources, while Playwright is already available and pinned in the runtime.

**Alternatives considered**:

- User-facing MHTML: rejected because it is Chromium-specific and difficult to sanitize as a safe served artifact.
- Mozilla Readability only: retained as a possible extraction aid but rejected as the sole artifact because it discards page structure and styling.
- Full-page screenshot: rejected as the primary copy because text is not structurally readable or accessible.
- SingleFile CLI: capable, but rejected as the default because AGPL licensing is a product-level decision.
- WARC/WACZ replay: deferred because a safe replay stack is operationally heavier than the first release needs.

**Primary references**: [Playwright browser contexts](https://playwright.dev/docs/browser-contexts), [Playwright network interception](https://playwright.dev/docs/network), [Chrome DevTools Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/), [Monolith](https://github.com/Y2Z/monolith), [Mozilla Readability](https://github.com/mozilla/readability)

## 5. Capture Network and Rendering Security

**Decision**: Treat capture as an untrusted network/browser workload. Permit HTTP/HTTPS only; reject user-info and ambiguous addresses; restrict ports; resolve all A/AAAA records; block loopback, private, link-local, unique-local, multicast, metadata, test/documentation, unspecified, and reserved ranges; validate and pin the connection address; and reapply policy to every redirect and subresource. Deny direct worker egress when deployable network policy is available.

Run Chromium unprivileged in fresh credential-free contexts with service workers and non-gateway traffic disabled. Apply CPU, memory, process, request, byte, and deadline limits. The worker receives no app session, cloud credential, database path beyond its required interface, or host mount beyond isolated staging/blob access.

**Rationale**: User-supplied URLs make the server an SSRF target. Parser checks alone do not prevent redirect or DNS rebinding attacks, while browser subresources multiply the surface. Isolation and egress restriction provide defense in depth when application checks fail.

**Alternatives considered**:

- URL syntax validation alone: rejected because it cannot stop public names resolving to private targets or unsafe redirect chains.
- Domain allowlist: impossible because arbitrary public bookmarks are an approved capability.
- Running the worker with the API's full privileges: rejected because hostile pages and browser vulnerabilities should not expose primary application state.

**Primary references**: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [RFC 9110 redirects and content types](https://www.rfc-editor.org/rfc/rfc9110.html), [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html), [RFC 4193](https://www.rfc-editor.org/rfc/rfc4193.html)

## 6. Safe Saved-Copy Viewing

**Decision**: Serve snapshots from a dedicated snapshot route, place that route on a separate hostname in production where available, and display it only inside an iframe with an empty `sandbox` attribute so it receives an opaque origin even in a single-host environment. Use a CSP that denies scripts, connections, forms, frames, objects, workers, media, base URLs, and navigation-capable behavior while allowing only local/data images and styles. Strip active elements and remote references before publication and verify the copy while all networking is disabled.

PDFs are read through a pinned PDF.js viewer with PDF JavaScript actions, external navigation, attachments, form submission, and network access disabled. An explicit separate action downloads the original bytes.

**Rationale**: Sanitization can have defects. An opaque sandboxed origin and strict response headers reduce the impact of missed markup, CSS, SVG, or browser behaviors and ensure that saved copies do not gain application-origin authority.

**Alternatives considered**:

- Inject sanitized markup into the React DOM: rejected because one sanitizer bypass would compromise the application origin.
- Direct browser PDF embedding: rejected because an isolated controlled viewer gives clearer policy over embedded actions and network behavior.

**Primary references**: [WHATWG iframe sandbox](https://html.spec.whatwg.org/multipage/iframe-embed-object.html), [Content Security Policy Level 3](https://www.w3.org/TR/CSP/), [MDN CSP reference](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Security-Policy)

## 7. Search Grammar and Indexing

**Decision**: Own a bounded lexer/parser and compile a validated AST rather than expose FTS syntax. Grammar and precedence are documented in `contracts/search-grammar.md`. Text atoms query regular FTS5 tables; tag atoms use canonical relational tags. Combine bookmark-ID sets with SQL `UNION`, `INTERSECT`, and `EXCEPT`. Bind every value.

Use `unicode61` with diacritic folding. Plain terms search bookmark fields and tag names. Quoted phrases mean a token sequence within one field. Multiple tag-filter chips use match-all semantics. Scope is applied as the AST universe, and saved views store verbatim user query plus tag IDs rather than SQL or a serialized internal AST.

**Rationale**: Approved unary exclusion, exact tags, and precedence differ from FTS5's grammar. A separate parser yields stable, explainable errors and prevents user punctuation from becoming database syntax. Set composition correctly handles boolean expressions mixing text and relational tag predicates.

**Alternatives considered**:

- Forward the query directly to FTS5: rejected because its `NOT` is binary, implicit-AND precedence differs, and punctuation rules are version-sensitive.
- `LIKE` scans: rejected because they provide weak token/phrase semantics and scale poorly across fields.
- External-content/contentless FTS: rejected initially because update/delete consistency is more complex; the duplicated index is small at 10,000 records.

**Primary references**: [SQLite FTS5](https://sqlite.org/fts5.html), [SQLite query planner](https://sqlite.org/queryplanner.html)

## 8. Browser Bookmark Interchange

**Decision**: Support the de-facto Netscape bookmarks HTML common subset: nested `DL`, folder `H3`, and bookmark `A HREF` with optional `ADD_DATE`. Parse inertly with a tolerant streaming tokenizer. Convert every enclosing folder name to a tag, apply normal URL normalization/deduplication, ignore unsupported extras, and reject non-HTTP(S) schemes.

Export a flat deterministic UTF-8 list using the conservative browser shape. Do not encode tags as folders because many-to-many tags would require duplication or arbitrary loss. Disclose all omitted app-specific fields before export.

**Rationale**: Major browsers interoperate on this historical format even though no normative standard exists. Real files contain optional/malformed HTML and large embedded favicons, making a strict XML parser or DOM render inappropriate.

**Alternatives considered**:

- Render the import file in a browser: rejected because it can execute hostile content and consumes excessive memory.
- Regex parsing: rejected because optional HTML structure and encoding variants are not regular or reliably bounded.
- Export tags as folder trees: rejected because a bookmark with multiple tags cannot round-trip without duplication.

**Primary references**: [Chromium bookmark writer](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/bookmarks/bookmark_html_writer.cc), [Chromium importer](https://chromium.googlesource.com/experimental/chromium/src/+/lkgr/chrome/utility/importer/bookmark_html_reader.cc), [Firefox export fixture](https://searchfox.org/firefox-main/source/browser/components/migration/tests/unit/bookmarks.exported.html), [Safari import/export documentation](https://developer.apple.com/documentation/safariservices/importing-data-exported-from-safari)

## 9. Rich Notes

**Decision**: Store user-authored Markdown and a derived plain-text index value. Support the approved subset—headings, ordered/unordered lists, emphasis, and links—and sanitize rendered output. Keep raw HTML disabled.

**Rationale**: Markdown provides durable editable source for the requested formatting without persisting opaque editor-specific HTML. A derived text field makes search predictable.

**Alternatives considered**:

- Store arbitrary rich HTML: rejected because safe editing/rendering and migrations are more complex.
- Editor-specific JSON: rejected because it couples persistent data to one UI library without a requirement for collaborative/block editing.

## 10. Verification and Delivery

**Decision**: Use Vitest for fast unit/integration tests and Playwright 1.61.0 for end-to-end and hostile-content/offline validation. All capture tests use deterministic local fixtures and an injectable test network policy; public internet is never required. Build and dependency installation complete before the harness starts `npm start` at `0.0.0.0:4000`.

**Rationale**: Deterministic fixtures allow exact assertions for metadata, delayed assets, redirects, failures, hostile markup, PDF hashes, restart recovery, and offline access. Pinning Playwright to 1.61.0 matches the installed browser revision.

**Alternatives considered**:

- Live-site acceptance tests: rejected because results change, network availability varies, and hostile/failure cases cannot be controlled.
- Unit tests only: rejected because capture, browser sandboxing, import compatibility, and restart durability are integration behaviors.

**Primary references**: [Vitest guide](https://vitest.dev/guide/), [Playwright web server testing](https://playwright.dev/docs/test-webserver), [Playwright API testing](https://playwright.dev/docs/api-testing)

## Residual Risks

- The representative capture corpus and definition of an "essential image" must be versioned with acceptance fixtures so the 95% outcome remains reproducible.
- No generic capture system can perfectly retain authenticated, DRM, canvas/WebGL, consent-blocked, or continuously updated pages; these produce warnings or failure, never a misleading success.
- Sanitizing CSS, fonts, SVG, and media trades some fidelity for safety.
- Content-addressed equality would become a privacy boundary if multi-user accounts are added; deduplication scope must then be revisited.
- A database snapshot and blob tree form one backup unit.
- SQLite and the local filesystem deliberately prevent horizontal multi-replica operation; that is outside the approved scope.
