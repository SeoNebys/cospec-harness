# Research Decisions: Bookmark Manager

## Stack and Persistence

**Decision**: One Next.js 16.3.5/React 19.3.0 TypeScript app on Node 24 LTS, exact-pinned with an npm lockfile. Use SQLite through better-sqlite3 and Drizzle with WAL, migrations, and FTS5.

**Rationale**: One process delivers UI and same-origin server operations while sharing schemas and types. SQLite provides local durability, uniqueness, joins, transactions, and text search without another service. Node 24 is LTS and React 19.3 is current ([Node releases](https://nodejs.org/en/about/previous-releases), [React versions](https://react.dev/versions)).

**Alternatives considered**: Vite plus Express adds wiring; PostgreSQL adds needless operations; Electron is outside web scope; `LIKE` scans and weak phrase semantics do not meet search needs.

## Search

**Decision**: Build a small lexer and recursive-descent parser producing a typed, versioned AST. Precedence is exclusion, AND, then OR; adjacent terms imply AND. Compile text leaves to escaped FTS5 parameters and exact tags/status to indexed relational predicates.

**Rationale**: This exactly implements the approved language, provides visible interpretation and source-span errors, and never exposes raw SQL/FTS syntax. Saved searches retain original text plus versioned structured criteria.

**Alternatives considered**: Generic parsers mismatch the grammar; raw FTS is unsafe/confusing; storing only AST loses authored text; a search service is excessive at 10,000 rows.

## Metadata and Icons

**Decision**: Fetch server-side using a guarded HTTP client. Permit absolute HTTP(S) on ports 80/443; reject credentials and all non-public/reserved destinations after DNS resolution; pin the checked address; recheck up to five redirects; send no cookies/auth/proxy credentials. Limits: 3-second connect, 10-second overall, 64 KiB headers, 2 MiB decoded HTML. Parse inert HTML, prefer Open Graph then ordinary metadata, cap title at 300 and description at 2,000, and never overwrite manual edits or adopt remote canonical URLs.

Icons use the same guard with three redirects, 5 seconds, 512 KiB, and 512×512 dimensions. Accept PNG/ICO/JPEG/WebP, decode and re-encode locally to PNG, never hotlink, and use a fallback. This follows controlled-redirect and destination-validation principles in [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

**Alternatives considered**: Client fetching hits CORS and exposes user IP; browser automation is heavy; third-party services leak saved URLs; hotlinked icons enable tracking.

## Notes

**Decision**: Store Markdown source and render only paragraphs, headings, ordered/unordered lists, and HTTP(S) links through a strict sanitizer. Disable raw HTML/images/embeds; limit notes to 50,000 characters; derive visible text for FTS.

**Rationale**: Source stays editable and benefits from future sanitizer fixes. Protocol allowlisting and sanitization align with [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

**Alternatives considered**: Stored HTML loses edit fidelity; arbitrary HTML is unsafe; a rich editor exceeds the approved subset.

## Import and Export

**Decision**: Parse Netscape-style HTML with parse5, map every folder-path segment to a tag, accept only HTTP(S), and ignore embedded icon data. Limits: 10 MiB, 10,000 links, 50 nesting levels, 100 tags/bookmark, 100 characters/tag, title 300, description 2,000. Stage before writes, then add valid unique entries without overwrites and report deterministic counts/reasons.

Export escaped UTF-8 browser HTML containing active/archived titles, URLs, dates, tags, and plain descriptions where interoperable, while disclosing loss of app-specific data. Major browsers document this workflow ([Chrome](https://support.google.com/chrome/answer/96816), [Firefox](https://support.mozilla.org/en-US/kb/export-firefox-bookmarks-to-backup-or-transfer)).

**Alternatives considered**: Regex parsing is fragile; rebuilding folders from arbitrary tags is ambiguous; embedded icons expand risk and size.

## Bulk Actions

**Decision**: Selection is explicit IDs or all matches plus exclusions. Preview stores an expiring opaque target snapshot. Execution re-evaluates exact eligibility inside a transaction; any set difference—not only count difference—returns `409 stale_selection` and requires reconfirmation. A target table supports set-based changes.

**Rationale**: Users confirm precisely the items changed while transactional operations are atomic.

**Alternatives considered**: Frozen snapshots violate refreshed-count behavior; silent reruns may affect unseen records; revision-only checks reject unrelated changes.

## Validation and Testing

**Decision**: Zod validates form, route, and service boundaries. Limits: URL 2,048; title 300; description 2,000; note 50,000; tag 100; 100 tags/bookmark; saved-search name 100. Vitest covers units/services/integration, Testing Library covers components, and exact Playwright 1.61.0 uses the supplied browser.

**Rationale**: Generous bounds prevent resource abuse. Property/table tests cover normalization and parsing; controlled HTTP fixtures cover SSRF; seeded 10,000-row tests verify budgets.

**Alternatives considered**: Unbounded input undermines performance/security; downloading another browser conflicts with the runtime.
