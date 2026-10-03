# Research: Personal Bookmark Manager

## Application Architecture

**Decision**: Use a single TypeScript package on Node.js 24 LTS. Build a React 19.3 client with Vite 8, expose a Fastify 5 JSON API, and have Fastify serve the built client in production on `0.0.0.0:4000`.

**Rationale**: Metadata retrieval and SQLite require a trusted server boundary, while the interactive library benefits from a component-based browser UI. One process and package fit the personal, single-user scope and the required runtime contract. Node 24 is an LTS release; the chosen framework versions support it.

**Alternatives considered**: A browser-only app cannot reliably fetch cross-origin metadata or enforce SSRF controls. Separate client/server deployables duplicate configuration and operations. A full-stack SSR framework adds routing and rendering conventions without a public-page or SEO need.

## Persistence

**Decision**: Use file-backed SQLite through Node 24's built-in `node:sqlite`, direct parameterized SQL, explicit numbered migrations, foreign keys, transactions, and write-ahead logging.

**Rationale**: The data is relational, local, and expected to stay near 1,000 bookmarks. Built-in SQLite avoids a separate service and native add-on while supporting uniqueness and transactional tag updates. Repository modules keep SQL out of request handlers.

**Alternatives considered**: Browser storage ties data to a browser profile and cannot support the server's responsibilities. PostgreSQL adds an unnecessary service. An ORM adds generated code and migration machinery disproportionate to the small schema. The built-in module is release-candidate in Node 24, so its limited wrapper surface will be isolated in `src/server/db` and covered by integration tests.

## Metadata Retrieval and SSRF Boundary

**Decision**: Fetch metadata only on the server through a dedicated service. Accept absolute HTTP/HTTPS URLs without credentials. Resolve every host, reject any non-globally-reachable IPv4 or IPv6 result, connect only to a validated address, and repeat validation for every manually followed redirect. Permit at most five redirects and detect loops. Apply network egress denial to private/link-local ranges as defense in depth.

**Rationale**: User-provided URLs make this an SSRF boundary. Validating only the initial URL leaves redirects and DNS rebinding open. OWASP recommends disabling automatic redirects for SSRF-sensitive requests, and the IANA special-purpose registries define address ranges that are not globally reachable.

**Alternatives considered**: Automatic redirects and validation-before-fetch are simpler but unsafe. A domain allowlist is unsuitable for a general bookmark manager. Headless-browser rendering expands execution risk and cannot reliably meet the five-second goal.

## Fetch Limits and Content Handling

**Decision**: Send an unauthenticated GET with a fixed non-secret user agent and HTML accept header. Allow only default HTTP/HTTPS ports, a five-second total budget, bounded DNS/connect phases, at most 1 MiB of decompressed HTML, and only successful HTML/XHTML responses. Do not execute scripts, load page subresources, or process external entities. Limit concurrent preview requests.

**Rationale**: Fixed limits prevent slow, oversized, compressed, or non-HTML responses from exhausting the service. RFC 9110 treats Content-Type as the representation's media type, so the service will not guess binary content as HTML.

**Alternatives considered**: A preliminary HEAD request is inconsistently supported and doubles work. Content sniffing creates ambiguity. Fetching without hard byte and time budgets is not acceptable for an arbitrary destination.

## Metadata Selection and Fallback

**Decision**: Normalize extracted text, discard invalid/empty values, cap titles at 300 characters and descriptions at 2,000. Choose title from Open Graph title, HTML title, then Twitter title; choose description from Open Graph description, standard meta description, then Twitter description. For icons, evaluate declared icons deterministically, then an Apple touch icon, then same-origin `/favicon.ico`. Fetch and cache only supported raster icons through the same SSRF boundary, capped at 256 KiB and 512×512 pixels. If metadata is missing or retrieval fails, return field-level status and derive the editable title fallback from hostname and path. Never overwrite a user's edits implicitly.

**Rationale**: Deterministic precedence is testable and favors metadata intended for link presentation. Proxying validated raster icons avoids leaking the user's address and referrer to third-party icon hosts. Partial results satisfy the approved non-blocking save flow.

**Alternatives considered**: Body-text extraction is noisy. Remote icon URLs create privacy and reliability problems. SVG is excluded in v1 because safe sanitization expands scope. Automatic refresh conflicts with user-owned edits.

## Search Language and Execution

**Decision**: Parse one search string into a typed AST. Whitespace-separated clauses use implicit AND. Bare and quoted clauses search title, URL, description, notes, and tags; quoted text is an exact case-insensitive substring within one field. `tag:value` searches a complete normalized tag, and `tag:(article|book)` expresses alternatives. Support quoted tag values such as `tag:"science fiction"`. Reject malformed input with a stable code and character span. Limit input to 1,000 characters and 50 clauses.

**Rationale**: This grammar directly supports the approved examples without prematurely adding general Boolean precedence. An AST separates user syntax from persistence and leaves room for future field operators. The server compiles the AST into parameterized predicates; OR exists only inside a tag-alternative clause. At 1,000 rows, indexed relational queries and case-insensitive substring predicates are sufficient for the one-second goal.

**Alternatives considered**: Loose token splitting cannot express exact phrases or tag-only matching. Full Boolean syntax creates precedence and usability concerns not in the specification. FTS and external search services complicate tag/URL semantics and operations at this scale.

## Validation and Testing

**Decision**: Use Zod as the shared boundary schema. Use Vitest for pure units, React Testing Library for UI behavior and accessibility, Fastify request injection against temporary SQLite databases for integration tests, and Playwright 1.61.0 for end-to-end journeys. Metadata tests use local deterministic fixtures and injected DNS/fetch adapters, never live sites. Add automated accessibility checks as a supplement to keyboard and semantic assertions.

**Rationale**: Tests align with the riskiest boundaries: URL normalization, SSRF decisions, redirects, metadata fallbacks, query parsing, SQL compilation, persistence, and complete user journeys. Deterministic fixtures avoid external network flakiness.

**Alternatives considered**: Snapshot-heavy testing would not prove behavior. Live-network tests are nondeterministic and risk unsafe access. Browser tests alone make failures slow and difficult to localize.

## Primary References

- [Node.js 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [React versions](https://react.dev/versions)
- [Vite releases](https://vite.dev/releases)
- [Fastify documentation](https://fastify.dev/docs/latest/)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry)
- [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry)
- [RFC 9110: Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#name-content-type)
- [WHATWG HTML title](https://html.spec.whatwg.org/multipage/semantics.html#the-title-element)
- [WHATWG icon links](https://html.spec.whatwg.org/multipage/links.html#rel-icon)
- [Open Graph protocol](https://ogp.me/)
