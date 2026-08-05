# Phase 0 Research: Bookmark Manager

All technical unknowns from the plan's Technical Context are resolved below.

## R1. Application shape: client-only vs. full-stack

- **Decision**: Full-stack — a small backend API + SPA frontend.
- **Rationale**: FR-003 requires deriving a page title when the user omits one.
  Fetching an arbitrary third-party page from the browser is blocked by CORS, so
  title derivation must happen server-side. A backend also gives a clean, testable
  persistence boundary and a single source of truth for dedupe (FR-015).
- **Alternatives considered**: Pure client-side SPA with IndexedDB — simplest to
  host, but title auto-fetch would require a public CORS proxy (fragile, privacy
  concerns) or be dropped. Rejected to keep FR-003 first-class and reliable.

## R2. Persistence engine

- **Decision**: SQLite via `better-sqlite3` (single local file).
- **Rationale**: Single-user personal scope means no concurrency pressure. SQLite
  is zero-config, file-based (easy backup = copy one file), and handles thousands
  of rows with indexed search far below the perceived-instant threshold (SC-005).
  Synchronous `better-sqlite3` keeps the backend simple and fast for this scale.
- **Alternatives considered**: PostgreSQL (operational overhead unjustified for one
  user); flat JSON file (no indexed search, rewrite-whole-file cost grows with the
  collection, weaker durability). Rejected.

## R3. Search and filtering

- **Decision**: Server-side query with `LIKE`-based case-insensitive matching over
  title/address/tags plus tag-equality filtering, backed by indexes; combine free
  text and tag filter with AND.
- **Rationale**: Meets SC-002 (<10s to find among 500+) and SC-005 comfortably at
  the 2,000+ scale without extra infrastructure. Keeps the contract simple.
- **Alternatives considered**: SQLite FTS5 full-text index — more powerful but
  unnecessary at this scale and adds schema complexity; can be adopted later if the
  collection grows dramatically. Client-side filtering of the full set — would ship
  all rows to the browser; fine at 2,000 but doesn't scale as cleanly. Rejected for
  now, noted as a future option.

## R4. Title derivation

- **Decision**: On save, if no title is supplied, the backend performs a best-effort
  outbound GET of the address, parses `<title>` (falling back to Open Graph
  `og:title`), and uses the address itself if neither is available or the fetch
  fails. Fetch has a short timeout and a capped response size.
- **Rationale**: Satisfies FR-003 and the "no metadata available" edge case while
  never blocking or failing a save because a page is slow or unreachable.
- **Alternatives considered**: Rendering the page in a headless browser (heavy,
  unnecessary for a `<title>`); requiring manual titles (worse UX). Rejected.

## R5. Address validation

- **Decision**: Accept only well-formed `http`/`https` URLs; normalize for dedupe by
  l-casing scheme+host and trimming a trailing slash; validate with a URL parser +
  zod. Reject blank/unsupported schemes with a clear message (FR-002).
- **Rationale**: Matches the assumption that bookmarks are web pages, gives reliable
  duplicate detection (FR-015), and produces testable, unambiguous validation.
- **Alternatives considered**: Accepting any string (breaks FR-002/FR-007);
  aggressive normalization that strips query strings (would wrongly merge distinct
  pages). Rejected.

## R6. Delete confirmation & undo

- **Decision**: Deletion requires an explicit confirm in the UI; after deletion the
  UI shows a time-boxed "Undo" affordance. Implement undo as a soft-delete window:
  the record is marked deleted and purged after the undo window elapses (or restored
  on undo).
- **Rationale**: Directly supports FR-013, FR-014, and SC-006 (≥90% recoverable)
  without a full trash/versioning system.
- **Alternatives considered**: Hard delete + client-side cached copy for undo
  (loses undo if the page reloads within the window); permanent trash bin (more
  scope than required). Soft-delete window chosen as the simplest reliable option.

## R7. Frontend stack

- **Decision**: React 18 + Vite + TypeScript, minimal state (React state + a small
  fetch/query layer). List uses simple pagination or lightweight virtualization to
  stay responsive at scale.
- **Rationale**: Mainstream, well-tooled, testable with Vitest + Playwright; Vite
  gives a fast dev loop. Avoids a heavyweight state library the app doesn't need.
- **Alternatives considered**: Server-rendered templates (less interactive for live
  search); a larger framework (unjustified for ~4 flows). Rejected.

## R8. Testing strategy

- **Decision**: Vitest for unit (validation, normalization, title parsing, dedupe,
  components); Supertest against Fastify for API contract/integration; Playwright
  for the P1–P2 end-to-end journeys.
- **Rationale**: Each spec requirement maps to a testable layer; contract tests lock
  the API surface defined in `contracts/api.md`.
- **Alternatives considered**: E2E-only (slow, poor failure localization). Rejected.
