# Technical Research: Personal Bookmark Manager

**Date**: 2026-09-17  
**Status**: Complete — all planning unknowns resolved

## 1. Runtime and Application Shape

**Decision**: Use a single TypeScript 7/Node.js 24 package with React 19 and Vite 8 for the client and Fastify 5 for the same-origin API and production static server.

**Rationale**: The product is one interactive web application with no SEO or server-rendering requirement. A single production process minimizes operational complexity, while the client/server/shared source split preserves clear boundaries. Fastify provides schema validation and injection testing; Vite produces a static client bundle; Node 24 matches the supplied runtime.

**Alternatives considered**:

- Next.js or a React Router framework: unnecessary SSR and framework lifecycle complexity for a private single-screen application.
- Express: viable, but requires more assembly for schemas, response validation, and injection-style integration tests.
- Separate frontend and backend packages: useful at organizational scale, but adds build and dependency overhead without improving this single deployment.

## 2. API Schemas and Persistence

**Decision**: Define shared TypeBox schemas and use direct, parameterized SQL through `better-sqlite3` 13. Store all durable state in one migrated SQLite database.

**Rationale**: TypeBox 1.x supports the selected TypeScript line and lets Fastify validate JSON while sharing inferred DTO types with the client. Direct SQL keeps complex search-set composition and set-based bulk mutations explicit. SQLite fits one local user and supports transactions, FTS5, WAL, and database-level uniqueness.

**Alternatives considered**:

- Node's built-in `node:sqlite`: attractive, but Node 24 still labels it release-candidate stability.
- Drizzle or Prisma: useful for larger or portable schemas, but add abstraction over the feature's most specialized SQL.
- Browser-only storage: cannot reliably perform server-side metadata retrieval and is less robust for transactional bulk operations and durable migrations.

## 3. Search Grammar and Indexing

**Decision**: Implement a hand-written lexer and recursive-descent parser for the approved grammar. Evaluate its AST as bookmark-ID set operations. Use a contentful SQLite FTS5 trigram index for normalized title, address, description, and plain-note text, relational tag predicates, and a scan fallback for search atoms shorter than three characters.

**Rationale**: The grammar has only atoms, implicit/explicit `AND`, and `OR`, so a generator would be disproportionate. Parsing before SQL gives precise source-position errors and prevents SQLite search operators from leaking into the product language. Trigrams satisfy arbitrary substring matching; relational tags preserve exact `#tag` semantics and avoid phrases crossing tag boundaries. The short-term scan is bounded by the approved 10,000-row scale.

**Alternatives considered**:

- Plain `LIKE`/`instr` for every term: simpler, and likely adequate at 10,000 rows, but lacks the same headroom for common substring queries. It remains a fallback if the bundled SQLite lacks the required tokenizer.
- Ordinary word-token FTS: does not meet arbitrary partial matching.
- Passing the query directly to FTS: would accidentally expose unsupported operators and produce inconsistent validation.

## 4. Stable Bulk Selection

**Decision**: Materialize each selection as an expiring server-side selection set and selection-item snapshot. Consume it once in a single bulk-action transaction.

**Rationale**: “Select all” must include off-screen results but must not silently gain or lose items if metadata changes before the action. A snapshot keeps confirmation counts exact, avoids browser payloads containing thousands of identifiers, and supports efficient set-based updates.

**Alternatives considered**:

- Re-run the search criteria when applying the action: small payload, but the affected set can drift after selection.
- Send every identifier from the browser: feasible at 10,000 items, but produces larger requests and weaker count integrity.

## 5. Page Metadata Retrieval

**Decision**: Save with fallbacks immediately, then run a bounded server-side metadata job. Use a dedicated HTTP(S) fetcher with per-hop DNS/IP validation and pinning, manual redirect handling, no credentials/cookies/proxy inheritance, a five-second overall deadline, a one-megabyte decoded HTML limit, and accepted HTML content types only.

**Rationale**: Browser retrieval is unreliable because of cross-origin restrictions. Server retrieval creates an SSRF boundary, so every initial and redirected destination must resolve only to globally routable addresses and the connection must use the already validated answers. Static HTML provides the required metadata without executing untrusted scripts.

**Metadata precedence**:

- Title: non-empty HTML `<title>`, then `og:title`, then address-derived fallback.
- Description: standard meta description, then `og:description`, then empty.
- Icon: declared raster icon candidates, then same-origin `/favicon.ico`, then placeholder.

**Resource policy**: Up to five redirects; stop after document head where possible; trim controls/whitespace; cap title at 512 and description at 2,048 Unicode scalar values; use friendly failure categories.

**Alternatives considered**:

- Headless browser: executes far more untrusted behavior and consumes substantially more resources.
- URL-text or first-IP validation only: vulnerable to alternate DNS answers, redirects, and rebinding.
- Allowing arbitrary custom-port retrieval: broadens the service into a port-probing primitive; custom-port bookmarks can still be stored with fallbacks.

## 6. Site Icon Handling

**Decision**: Fetch icons through the same outbound safety policy, cap transfer at 256 KiB and decoded size at one megapixel, reject SVG/XML/HTML and spoofed types, then resize/re-encode to a small PNG with Sharp and store it under an application-generated content hash.

**Rationale**: Rendering remote icon URLs would contact every saved site from the user's browser and accept tracking, mixed-content, and active-content risks. Re-encoding and same-origin serving give a predictable safe artifact.

**Alternatives considered**:

- Direct remote icon URLs: simplest, but privacy and content-safety behavior is unacceptable.
- Cache verified original raster bytes: lower cost, but retains animation, metadata, and decoder ambiguity.

## 7. Late Metadata and Manual Overrides

**Decision**: Track an address revision/request token and independent title/description provenance (`fallback`, `retrieved`, `user`). A metadata transaction updates only a matching revision and non-user fields; stale results become no-ops, while alternative retrieved values may be offered for explicit acceptance.

**Rationale**: This works across immediate saves, reloads, concurrent tabs, address edits, and out-of-order jobs. Client-only dirty flags do not.

**Alternatives considered**:

- Last response wins: violates the approved no-overwrite behavior.
- Cancel only in the browser: does not survive disconnects or server work already in progress.

## 8. Address and Name Normalization

**Decision**: Use the WHATWG URL parser, retain the entered destination for display/opening, and derive the exact database uniqueness key approved in FR-005. Normalize tag and saved-view keys with whitespace cleanup, Unicode normalization, and locale-independent lowercase, while preserving display spelling.

**Rationale**: An application pre-check provides friendly navigation, while a unique database index closes concurrent races. Application-derived Unicode keys avoid SQLite's ASCII-only built-in case folding.

**Alternatives considered**:

- Redirect or page-canonical identity: would merge aliases and short links explicitly excluded by the specification.
- SQLite `NOCASE` alone: insufficient for general Unicode.

## 9. Formatted Notes

**Decision**: Store Markdown source, derive visible plain text through an AST for search, and render via react-markdown with raw HTML and unsupported node types disabled. Permit only headings, paragraphs, emphasis, lists, links, inline code, and line breaks; allow safe link protocols only.

**Rationale**: Canonical source remains editable and benefits from future renderer security updates. AST extraction is more accurate than removing punctuation with regular expressions. React rendering with a narrow element/protocol allowlist avoids an HTML injection sink.

**Alternatives considered**:

- Store rendered HTML: persists potentially unsafe output and makes later sanitizer improvements ineffective for old data.
- Rich-text document model: unnecessary for the deliberately small formatting set.

## 10. Test and Delivery Tooling

**Decision**: Use Vitest 5 for unit/integration/component tests, Testing Library for user interaction, Fastify injection with temporary real databases, Playwright 1.61.0 for E2E, and Axe plus manual keyboard checks for accessibility. Use Biome for formatting/linting.

**Rationale**: These layers cover pure rules, transactions, the accessible component surface, and built-system behavior. The exact Playwright pin matches the installed browser revision. Deterministic injected DNS/HTTP fixtures test security without weakening production rules or depending on the public Internet.

**Alternatives considered**:

- Public-site metadata tests: slow and nondeterministic.
- Automated accessibility checks alone: cannot prove focus order, announcements, or full keyboard usability.
- Latest Playwright release: may require browser binaries not present in the runtime image.

## Primary References

- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Node.js 24 SQLite API and stability](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [React 19.3 release](https://react.dev/blog/2026/09/09/react-19-3)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [SQLite FTS5 trigram tokenizer](https://www.sqlite.org/fts5.html#the_trigram_tokenizer)
- [SQLite WAL](https://www.sqlite.org/wal.html)
- [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry)
- [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry)
- [WHATWG URL Standard](https://url.spec.whatwg.org/)
- [HTML title, metadata, and link semantics](https://html.spec.whatwg.org/multipage/semantics.html)
- [Open Graph protocol](https://ogp.me/)
- [react-markdown security behavior](https://github.com/remarkjs/react-markdown#security)
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
