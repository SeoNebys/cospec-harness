# Phase 0 Research: Bookmark Manager

## Runtime and application shape

**Decision**: Use Node.js 24 LTS and TypeScript in a single-package application. Fastify 5 serves a Vite 8-built React 19.3 client and the internal JSON API from one process.

**Rationale**: Node 24 is the installed LTS runtime and supports the current frontend/test toolchain. One language and one process keep domain schemas and deployment simple. A server is mandatory for durable data, uniqueness enforcement, and safe metadata retrieval; the client remains a responsive SPA because the product does not need server-rendered public pages.

**Alternatives considered**:

- Client-only IndexedDB: rejected because arbitrary metadata fetches are blocked by browser cross-origin rules, duplicate enforcement cannot be centralized, and saved remote assets would be unreliable.
- Next.js or another full-stack meta-framework: rejected because server rendering and framework-specific server components add no value to this private application.
- Separate frontend and backend packages: rejected because independent release/version boundaries are unnecessary for one deployable.

**Sources**:

- Node.js 24 release/LTS status: https://nodejs.org/en/about/previous-releases
- Fastify 5 documentation and Node support: https://fastify.dev/docs/latest/
- Vite runtime requirements: https://vite.dev/guide/
- React versions: https://react.dev/versions

## Database and media persistence

**Decision**: Use SQLite through `better-sqlite3`, SQL migration files, foreign keys, WAL mode, prepared statements, and transactions. Store bounded, processed raster assets as content-addressed SQLite BLOBs.

**Rationale**: The workload is single-user, local, write-light, and capped around 1,000 bookmarks. SQLite provides atomic uniqueness and state changes without an external service. `better-sqlite3` is tested on Node 24 and has a mature synchronous transaction API; these short queries do not justify asynchronous database infrastructure. BLOB storage makes bookmark/asset attachment crash-atomic, and content hashes deduplicate media. Raster processing and output caps keep database growth bounded.

**Alternatives considered**:

- Node's built-in `node:sqlite`: promising but still marked release candidate in Node 24 documentation, so it is not the conservative choice for durable user data in this release.
- PostgreSQL: rejected because multi-user concurrency and remote database administration are outside scope.
- Browser storage: rejected because it cannot back the server-side metadata and uniqueness workflows.
- Remote image URLs only: rejected because third parties could observe later views, images could disappear, and saved visual details would not persist reliably.
- Content-addressed filesystem assets: viable if media volume later becomes material, but rejected for v1 because coordinating file promotion and database commit weakens atomicity.

**Sources**:

- Node 24 `node:sqlite` status: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- `better-sqlite3` project and suitability guidance: https://github.com/WiseLibs/better-sqlite3
- Node 24 build matrix: https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml

## Metadata extraction and outbound-request security

**Decision**: Implement a dedicated outbound fetch policy around a manually redirected HTTP client. Resolve and classify every target, pin a vetted public address for each connection, re-run validation for every redirect, and impose strict time, byte, content-type, and redirect limits. Parse bounded HTML with Cheerio; never render or return scraped markup.

**Rationale**: The URL is user-controlled, so a normal server-side fetch would create an SSRF path into loopback, private-network, link-local, and cloud-metadata services. Validating only the initial hostname is insufficient because redirects and DNS rebinding can change the destination. Cheerio extracts static page metadata without executing third-party JavaScript, which is safer and sufficient for standard title, description, icon, Open Graph, and Twitter-card fields.

**Policy**:

- Accept only HTTP and HTTPS; strip fragments for retrieval but preserve the saved address.
- Reject credentials for retrieval, non-public IPv4/IPv6 ranges, malformed hosts, and any redirect that fails the same rules.
- Pin the vetted IP for the connection while preserving the original host for HTTP Host and TLS verification.
- Allow no more than three redirects and reject HTTPS-to-HTTP downgrade; do not forward cookies, authorization, or user headers.
- Apply a 4-second total retrieval deadline so the UI can satisfy its 5-second outcome, with tighter connect/idle deadlines.
- Cap decompressed HTML at 1 MiB, icon input at 1 MiB, preview input at 5 MiB, and accept only HTML/XHTML plus verified raster image formats. Decode with strict pixel limits, reduce animation to the first frame, strip metadata, and emit icons as PNG up to 128×128 and previews as WebP up to 1200×630.
- Extract in this order: Open Graph title then document title; Open Graph/Twitter/standard description; declared icons then conventional favicon; Open Graph/Twitter image.
- Use a 30-minute metadata draft that references staged content-addressed BLOBs. Attach verified assets in the bookmark transaction and garbage-collect only unreferenced staged assets after their retention window.

**Alternatives considered**:

- Cheerio `fromURL`: rejected for this path because the application must own DNS pinning, redirect checks, and expanded-byte limits rather than delegate navigation.
- Headless browser extraction: rejected for v1 because it greatly expands resource use and attack surface; JavaScript-only pages fall back to manual entry as approved.
- A third-party metadata API: rejected because it introduces cost, availability, and privacy dependencies not required by the spec.

**Sources**:

- OWASP SSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- WHATWG URL Standard: https://url.spec.whatwg.org/
- IANA IPv4 and IPv6 special-purpose registries: https://www.iana.org/assignments/iana-ipv4-special-registry/ and https://www.iana.org/assignments/iana-ipv6-special-registry/
- Node DNS behavior: https://nodejs.org/api/dns.html
- Undici client controls: https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md
- Cheerio loading behavior: https://cheerio.js.org/docs/basics/loading/
- Cheerio security warning: https://cheerio.js.org/docs/advanced/security/
- Sharp input/output controls: https://sharp.pixelplumbing.com/api-constructor/ and https://sharp.pixelplumbing.com/api-output/

## Duplicate identity

**Decision**: Centralize the exact approved normalization algorithm in `src/shared/urls/`, store its output in `bookmarks.normalized_url`, and enforce a unique database index across every bookmark regardless of archive state.

**Rationale**: A pre-save lookup supplies the correct user journey, while the unique index is required to prevent races. Keeping original and normalized forms preserves what the user entered while making equality stable.

**Normalization**:

- Trim surrounding whitespace and require a parseable HTTP(S) address.
- Lowercase scheme and host and remove default ports.
- Treat an empty path and `/` as the same path.
- Preserve other path case and accepted encoding plus query ordering/content and fragment content as distinct, matching the approved spec. Do not use a fully serialized WHATWG `href` as the key because it may normalize additional path forms.

**Alternatives considered**:

- Strip tracking parameters or trust page canonical metadata: rejected because it could merge addresses the client explicitly approved as distinct.
- Application check without a unique index: rejected because concurrent requests could still create duplicates.

## Search grammar and execution

**Decision**: Implement a small recursive-descent parser shared by client and server. It returns an AST for terms, phrases, tag predicates, conjunctions, and disjunctions. The server evaluates the AST over normalized search documents after view/filter selection, then performs stable sorting and pagination.

**Rationale**: The approved syntax has explicit semantics that do not exactly match SQLite FTS query syntax. A purpose-built parser produces precise error offsets and keeps product behavior stable. Evaluating at most about 1,000 compact records is comfortably inside the 1-second goal and avoids dynamic SQL complexity.

**Safety bounds**: 500 input characters, 64 conditions, and 10 nested parenthesis levels. Exceeding a bound returns a preserved, actionable syntax error.

**Alternatives considered**:

- SQLite FTS query syntax exposed directly: rejected because its operators and escaping would leak database behavior into the product contract.
- Dynamically generated Boolean SQL: rejected because it adds parameterization and precedence complexity without a scale benefit.
- Search entirely in the browser: rejected because pagination, consistent archive scoping, and API contract behavior would drift.

## Rich notes

**Decision**: Use Tiptap 3 with its React bindings and a deliberately configured StarterKit. Persist validated ProseMirror-compatible JSON plus server-derived plain text; render with the same whitelisted schema in read-only mode.

**Rationale**: StarterKit contains the required paragraphs, headings, bold, italic, lists, blockquotes, links, and history. Structured JSON makes allowed content explicit and avoids trusting user or scraped HTML. Server-side validation and plain-text derivation make search and safety independent of the client.

**Allowed content**: document, paragraph, text, heading levels 2–3, bullet/ordered lists, list items, blockquote, hard break; bold and italic marks; HTTP(S) links. Raw HTML, images, scripts, styles, iframes, and arbitrary attributes are rejected.

**Alternatives considered**:

- Markdown textarea: safe and simple, but does not meet the expectation of formatting and seeing notes rendered with a low-friction toolbar as directly.
- Storing editor HTML: rejected because sanitization becomes the primary data boundary and search extraction is less reliable.
- A custom `contenteditable` editor: rejected because selection, keyboard, history, and accessibility behavior are costly to reproduce correctly.

**Sources**:

- Tiptap React integration: https://tiptap.dev/docs/editor/getting-started/install/react
- StarterKit contents and configuration: https://tiptap.dev/docs/editor/extensions/functionality/starterkit
- Tiptap persistence and security: https://tiptap.dev/docs/guides/output-json-html
- WAI-ARIA toolbar pattern: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

## Client navigation and server state

**Decision**: Use React Router declarative routing and TanStack Query for request lifecycle, caching, mutation state, and invalidation. Put view/search/filter state in route query parameters; store the sort preference server-side.

**Rationale**: Routes make active, To Read, Archive, details, and editing navigable and restorable. Query parameters preserve collection context when a duplicate redirects to an existing bookmark. TanStack Query handles server-state races such as metadata preview replacement and mutation invalidation without creating a global client data store.

**Alternatives considered**:

- A global Redux-style store: rejected because nearly all durable state belongs to the server and query URL.
- React local state only: acceptable for forms, but insufficient for consistent list invalidation and mutation status across routes.

**Sources**:

- React Router modes: https://reactrouter.com/start/modes
- TanStack Query React API: https://tanstack.com/query/latest/docs/framework/react/reference/index
- React Aria Components: https://react-spectrum.adobe.com/react-aria/components.html

## API validation and contract

**Decision**: Define the internal HTTP interface in OpenAPI 3.1, implement Fastify request/response schemas with TypeBox, and add contract tests that validate representative success and error responses.

**Rationale**: Fastify 5 requires full JSON schemas and can generate OpenAPI documents from route schemas. A checked-in contract gives tasks and tests one stable description, while shared TypeScript schemas prevent hand-written client request drift.

**Alternatives considered**:

- GraphQL: rejected because this is a small CRUD/query surface and introduces unnecessary server/client machinery.
- Unspecified `fetch` calls: rejected because duplicate conflicts, search syntax errors, and metadata partial failures require stable typed error shapes.

**Sources**:

- Fastify v5 schema requirements: https://fastify.dev/docs/v5.0.x/Guides/Migration-Guide-V5/
- Fastify OpenAPI plugin compatibility: https://github.com/fastify/fastify-swagger
- OpenAPI specification: https://spec.openapis.org/oas/

## Testing and accessibility

**Decision**: Use Vitest for shared/server/component suites, React Testing Library for user-oriented component interaction, Fastify injection with temporary databases for API integration, and Playwright 1.61.0 with axe for end-to-end responsive/accessibility checks.

**Rationale**: The tools align with the TypeScript/Vite stack and cover pure domain rules, real persistence, internal contracts, and browser behavior. Playwright is pinned to the version whose Chromium binary is already present in the workspace image.

**Alternatives considered**:

- Browser tests only: rejected because security and parser edge cases require fast exhaustive lower-level tests.
- Snapshot-heavy component tests: rejected because accessible roles, names, focus, and visible outcomes are more stable and meaningful.

**Sources**:

- Vitest requirements: https://vitest.dev/guide/
- React Testing Library guidance: https://testing-library.com/docs/react-testing-library/intro/
- Playwright installation and supported browser testing: https://playwright.dev/docs/intro
- Axe Playwright integration: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
