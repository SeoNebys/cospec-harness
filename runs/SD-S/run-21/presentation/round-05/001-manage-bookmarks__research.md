# Research: Bookmark Management

## Full-stack application shape

**Decision**: Use Next.js 16 with React 19 and TypeScript as a single full-stack application.

**Rationale**: The feature needs a responsive interactive UI plus trusted server capabilities for persistence and remote page inspection. One application provides server rendering, form-friendly route handlers, shared validation types, and a single foreground runtime command without introducing a separately deployed API.

**Alternatives considered**: A separate React client and Express API would add deployment and contract coordination overhead without benefiting the single-user scope. A browser-only app cannot safely or reliably fetch arbitrary page metadata because of cross-origin restrictions and would make durable server-side persistence unavailable.

## Local persistence

**Decision**: Store data in SQLite using the SQLite interface included with Node.js 24, with schema initialization performed by an idempotent application script.

**Rationale**: SQLite gives durable relational storage, transactions, indexes, and effective querying for the required 10,000-bookmark scale while remaining a single-file operational dependency. The built-in interface avoids a native third-party database driver and supports parameterized queries.

**Alternatives considered**: JSON files make concurrent updates, relational tags, querying, and crash-safe transactions harder. PostgreSQL is robust but adds an external service that is unnecessary for one configured library. Browser-only storage would couple persistence to one browser profile and complicate server rendering.

## Page metadata extraction

**Decision**: Fetch metadata on the server and parse bounded HTML with Cheerio. Prefer Open Graph values, then standard metadata and document values; resolve relative image/icon references against the final page URL.

**Rationale**: Server retrieval avoids browser cross-origin limits. A small HTML parser is sufficient for deterministic extraction without executing destination scripts. A clear precedence rule makes results testable: title uses `og:title` then document title; description uses `og:description` then description metadata; preview uses `og:image`; icon uses declared icons then `/favicon.ico` as a candidate.

**Alternatives considered**: A headless browser handles script-rendered metadata but is slower, more resource-intensive, and exposes a much larger attack surface. Third-party metadata services add cost, privacy dependencies, and availability risk. Client-side fetching fails on many sites due to cross-origin rules.

## Safe remote URL retrieval

**Decision**: Allow only HTTP and HTTPS URLs; reject credentials, non-public ports unless explicitly allowed by configuration, and any hostname resolving to loopback, private, link-local, carrier-grade NAT, documentation, multicast, reserved, or unspecified IP ranges. Re-resolve and revalidate each redirect, limit redirects to five, response bytes to 2 MB, and total retrieval time to eight seconds. Accept only HTML-like content for parsing.

**Rationale**: A metadata endpoint that accepts arbitrary URLs creates server-side request-forgery risk. Validation must cover DNS results and every redirect, not merely the original string. Tight bounds protect responsiveness and memory.

**Alternatives considered**: A hostname denylist is incomplete. Allowing all URLs would expose local services and cloud metadata endpoints. Disabling metadata retrieval would violate the approved experience.

## URL and duplicate normalization

**Decision**: Store both the user's URL and a normalized comparison URL. Normalize scheme and hostname case, remove default ports and fragments, normalize an empty path to `/`, and preserve path/query semantics. Do not automatically remove marketing parameters or equate HTTP with HTTPS.

**Rationale**: This detects obvious duplicates without changing potentially meaningful destination semantics. The original address remains available for display/editing.

**Alternatives considered**: Exact-string matching misses cosmetic variants. Aggressive query stripping can collapse distinct resources and would need site-specific policy.

## Search, filtering, and sorting

**Decision**: Use parameterized SQLite queries over normalized searchable text with indexed state columns and stable secondary ordering. Start with case-insensitive substring matching across title, URL, description, notes, and tag names; paginate every view.

**Rationale**: At 10,000 records, this approach is simple, deterministic, and sufficient for the two-second user outcome. Pagination bounds rendering work. Stable ordering prevents results from jumping when primary values tie.

**Alternatives considered**: Full-text indexing adds migration and ranking semantics not required by the specification. Loading the entire library into the browser increases startup and memory costs.

## UI state and accessibility

**Decision**: Keep view, query, filters, sort, and page in URL parameters. Use semantic controls, visible focus, labeled icon actions, status text announced to assistive technology, responsive list/card presentation, and confirmation dialogs that manage focus correctly.

**Rationale**: URL state supports refresh, back/forward navigation, and direct links. Semantic interactions satisfy keyboard and screen-reader use while providing the same workflows on desktop and mobile.

**Alternatives considered**: Client-only transient state is easier initially but loses view context on refresh and makes browser navigation surprising.

## Test approach

**Decision**: Use Vitest for domain and route-level verification and Playwright 1.61.0 for end-to-end browser scenarios, with deterministic local metadata fixture pages.

**Rationale**: Unit tests efficiently cover edge-heavy normalization and network safety. Browser tests prove user-visible flows. Local fixtures avoid dependence on changing external pages and network availability.

**Alternatives considered**: End-to-end-only testing would be slow and make network edge cases difficult to isolate. Live internet fixtures would be nondeterministic.
