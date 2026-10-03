# Research: Personal Bookmark Manager

## Decision 1: Single-process TypeScript web application

**Decision**: Use React with TypeScript for the browser UI, Vite for development/build, and Express 5 on Node.js 24 for the service. The production process serves both the JSON API and built static client.

**Rationale**: The feature needs a responsive interactive form and collection UI plus a trusted server boundary for persistence and safe title retrieval. One language and one deployable process minimize first-release operational complexity. React documents direct TypeScript support, Vite provides an official React integration, and Express 5 supports the available Node runtime.

**Alternatives considered**: Server-rendered templates would reduce client tooling but complicate responsive search/filter state and non-blocking title suggestions. A metaframework would add routing and rendering features that this four-state application does not need. Separate frontend/backend deployments would add cross-origin session and deployment complexity without user value.

**Sources**: [React TypeScript guidance](https://react.dev/learn/typescript), [Vite getting started](https://vite.dev/guide/), [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/)

## Decision 2: SQLite through the pinned Node 24 runtime

**Decision**: Use file-backed SQLite through `node:sqlite`, pin Node 24.x, use prepared statements and foreign keys, and isolate database access behind repositories so the adapter can be replaced if deployment scale changes.

**Rationale**: The target scale is modest, relational constraints suit users/bookmarks/tags/sessions, and a local database keeps development and review self-contained. The runtime API supports prepared statements, transactions, foreign keys, defensive mode, and file/in-memory databases. Because the module is still release-candidate stability in Node 24, the runtime is pinned and all access stays behind a narrow boundary.

**Alternatives considered**: PostgreSQL provides stronger multi-instance scaling but requires an external service not justified for the first release. A native SQLite add-on is mature but adds platform-specific installation and rebuild concerns. Browser storage cannot enforce cross-session account privacy or safely retrieve page metadata.

**Source**: [Node.js 24 SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

## Decision 3: Server-side title retrieval with SSRF controls

**Decision**: Provide a dedicated authenticated title-preview endpoint that accepts only absolute HTTP(S) URLs, rejects private/special IP space after A/AAAA resolution, pins the validated resolution during connection, manually revalidates up to three redirects, applies a five-second overall timeout and one-mebibyte body ceiling, accepts only HTML, and streams markup until the title is known.

**Rationale**: Browser fetching is unreliable because many sites disallow cross-origin reads. Unrestricted server fetching would create an SSRF path into localhost, cloud metadata, and internal networks. OWASP specifically calls out scheme allowlisting, private/localhost address rejection, validating all DNS results, DNS pinning, and unsafe redirects.

**Alternatives considered**: Client-only metadata extraction does not work consistently across sites. An external metadata service adds cost and data disclosure. Disabling automatic titles contradicts the approved core experience. An allowlist of websites is safer but would make general bookmarking unusable.

**Source**: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## Decision 4: Editable, race-safe automatic suggestion

**Decision**: Automatically request a title after paste or blur when the URL is valid and the title is untouched/empty. Track the URL and request generation, cancel or ignore stale responses, and fill only an untouched empty title field.

**Rationale**: This directly satisfies the client's emphasized expectation while ensuring delayed network responses never replace the user's own work. A short debounce avoids duplicate calls without turning the action into a manual button click.

**Alternatives considered**: Fetching only after save hides latency but prevents confirmation before creation. A manual “Fetch title” button fails the automatic requirement. Overwriting any current title is destructive and surprising.

## Decision 5: Opaque database-backed sessions

**Decision**: Hash passwords asynchronously with scrypt and per-password random salts. Use random opaque session tokens stored only as digests, with idle/absolute expiry and an HttpOnly SameSite cookie. Validate same-origin requests for mutations.

**Rationale**: Database-backed sessions are easy to revoke, do not expose user data in client-readable tokens, and fit a single-process application. Node documents scrypt as intentionally costly for brute-force resistance and recommends unique random salts of at least 16 bytes. SameSite is defense in depth, so origin validation is retained for state changes.

**Alternatives considered**: Signed self-contained tokens complicate revocation. Third-party identity would broaden scope and require external configuration. Plain password hashing is unacceptable.

**Sources**: [Node.js crypto documentation](https://nodejs.org/download/release/v24.16.0/docs/api/crypto.html), [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Decision 6: Explicit duplicate warning with continuation

**Decision**: Canonicalize addresses for comparison by lowercasing scheme/host, removing default ports, normalizing an empty path to `/`, removing fragments, and preserving path/query semantics. Creation or editing returns a `409 DUPLICATE_BOOKMARK` with the existing item unless the user explicitly resubmits with `allowDuplicate: true`.

**Rationale**: This makes the warning enforceable across clients while preserving the specification's allowance for intentionally distinct records. Query parameters are preserved because they often identify different resources; tracking-parameter stripping is avoided because it is heuristic and may change meaning.

**Alternatives considered**: A database uniqueness constraint would block legitimate continuation. Warning only in the browser could be bypassed and race. Aggressive URL cleanup risks merging distinct destinations.

## Decision 7: Relational tag model and bounded collection queries

**Decision**: Store tags once per user with a normalized unique name and relate them to bookmarks through a join table. Use cursor pagination, transactional mutations, parameterized partial search, and intersection semantics for multiple tags.

**Rationale**: The model prevents tag spelling/case fragmentation, supports reliable filter counts, and preserves tags independently of individual bookmark edits. A 10,000-item personal collection is small enough for bounded relational queries while still requiring pagination and indexes.

**Alternatives considered**: JSON tag arrays simplify writes but complicate normalization and indexed filtering. Full-text search adds migration and query complexity unnecessary until measured results fail the one-second target.

## Decision 8: Layered automated verification

**Decision**: Use Vitest for domain logic, React Testing Library for interaction states, Supertest for API contracts, and Playwright 1.61.0 for end-to-end flows. Stub remote DNS/HTTP behavior with controlled fixtures.

**Rationale**: The riskiest behavior crosses layers: automatic title races, duplicate continuation, session isolation, and archive/delete state changes. Deterministic local fixtures cover redirects, private addresses, oversized pages, timeouts, malformed markup, and successful titles without depending on the public internet.

**Alternatives considered**: Browser tests alone are slow and cannot precisely cover network safety branches. Unit tests alone cannot prove the user's full workflow or API contract.
