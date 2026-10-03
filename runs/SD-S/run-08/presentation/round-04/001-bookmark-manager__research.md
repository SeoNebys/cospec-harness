# Research: Bookmark Manager

## Full-stack application

**Decision**: Use Next.js 16.3.3 App Router with React 19.2 and TypeScript 5.9 on Node.js 24, deployed as one persistent Node server.

**Rationale**: The app needs server-rendered reads, interactive forms, JSON endpoints, and server-only network access. The App Router supplies these in one supported model, and exact locked versions keep builds reproducible.

**Alternatives considered**: React Router framework mode is viable but requires more assembly. A separate API and SPA adds deployment overhead without serving the single-user scope.

## Persistence

**Decision**: Use SQLite with Prisma ORM 7.x and its `better-sqlite3` adapter. Store the database and cached icons below `data/`, outside public assets, and commit forward migrations.

**Rationale**: SQLite fits one installation and 10,000 records without a service. Prisma 7 provides Node 24 support, typed relations, constraints, transactions, and migrations; SQLite support in Prisma 8 is currently experimental.

**Alternatives considered**: Node's built-in SQLite API remains release-candidate stability and has less migration/type support. Drizzle is viable but offers less value here. PostgreSQL is operationally disproportionate for v1.

## Search

**Decision**: Maintain application-normalized search shadow fields and use escaped substring matching over title, URL, note, and tag keys. Combine text and tag filters with AND, use deterministic secondary sorts, and paginate 50 items by default (100 maximum).

**Rationale**: The spec requires partial text, including URL punctuation. Token full-text search changes those semantics. A bounded scan of 10,000 compact rows is simpler and will be benchmarked. Application normalization avoids SQLite's limited Unicode case conversion.

**Alternatives considered**: FTS5 is efficient for tokens and prefixes, not arbitrary infixes. A trigram index may be added by migration only if measurement shows it is needed.

## Metadata preview and title ownership

**Decision**: Separate metadata preview from creation. The preview retrieves the first HTML document title and an icon, supplies an editable fallback on failure, and records title origin as `fetched`, `fallback`, or `user`.

**Rationale**: This lets the user see and edit the actual fetched title before save. Provenance prevents later refreshes from overwriting edits, and lookup failure remains non-blocking.

**Alternatives considered**: Fetching only during creation prevents pre-save editing. Background-only enrichment changes saved content after the fact. Open Graph titles were rejected as the primary value because the requirement asks for the document title.

## Safe page retrieval

**Decision**: Use a server-only fetcher with globally-routable-address enforcement, DNS-to-connection pinning, peer verification, manual redirect validation, strict time/byte/content limits, inert parsing, bounded concurrency, sanitized errors, and deployment egress controls.

**Rationale**: Arbitrary URL retrieval creates an SSRF boundary. URL syntax checks alone do not stop DNS rebinding, mixed DNS answers, or redirects into protected networks.

**Alternatives considered**: Browser fetching is generally blocked by CORS and exposes the user's network. A third party adds privacy and availability dependencies. A generic server fetch after validation leaves DNS and redirect gaps.

## Site icons

**Decision**: Choose a declared icon, with same-origin `/favicon.ico` as a final attempt; retrieve it through the safe fetcher; accept raster formats only; decode and re-encode a small app-controlled PNG. Fall back to a bundled icon.

**Rationale**: Cached normalized assets prevent hotlink tracking, later content substitution, and active SVG behavior.

**Alternatives considered**: Remote URLs leak viewer traffic and can change. Arbitrary stored bytes retain risky formats and metadata. SVG support expands sanitization scope.

## Accessibility and testing

**Decision**: Prefer semantic native controls, use Radix only for focus-sensitive primitives, pin Playwright 1.61.0, and combine keyboard assertions, axe scans, and manual review.

**Rationale**: Semantic HTML minimizes custom behavior. Automated scans do not establish complete accessibility by themselves.

**Alternatives considered**: A full component kit broadens scope. Automated scans alone do not meet the keyboard and labeling requirements.

## Primary references

- Next.js: <https://nextjs.org/docs/app/getting-started/installation>, <https://nextjs.org/docs/app/guides/backend-for-frontend>
- Prisma and SQLite: <https://docs.prisma.io/docs/orm/v6/overview/databases/sqlite>, <https://www.prisma.io/docs/orm/supported-databases>
- SQLite: <https://www.sqlite.org/stricttables.html>, <https://www.sqlite.org/foreignkeys.html>, <https://www.sqlite.org/fts5.html>, <https://www.sqlite.org/pragma.html>
- OWASP SSRF prevention: <https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html>
- HTML title and icon semantics: <https://html.spec.whatwg.org/multipage/semantics.html#the-title-element>, <https://html.spec.whatwg.org/multipage/links.html#rel-icon>
- IANA address registries: <https://www.iana.org/assignments/iana-ipv4-special-registry/>, <https://www.iana.org/assignments/iana-ipv6-special-registry/>
- Playwright accessibility testing: <https://playwright.dev/docs/accessibility-testing>
