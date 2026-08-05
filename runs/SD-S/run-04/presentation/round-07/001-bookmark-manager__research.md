# Phase 0 Research: Bookmark Manager

This document resolves the open technical decisions for the plan. Each entry
records the decision, the rationale, and the alternatives considered.

## 1. Platform & project shape

- **Decision**: Local single-user **web application** with a thin backend and a browser frontend.
- **Rationale**: The client's must-have feature — automatic fetching of a page's title and preview when a link is pasted (FR-014) — requires making requests to arbitrary third-party sites. Browsers block this via the same-origin/CORS policy, so a backend is required to perform the fetch. A backend also gives durable persistence and fast full-text search (FR-004, SC-003). A web UI is the most portable way to deliver the list/search/tag experience without committing to an OS-specific toolkit.
- **Alternatives considered**:
  - *Browser-only SPA (no backend)*: Rejected — cannot fetch cross-origin metadata; would force manual titles, contradicting the approved change.
  - *Native desktop app*: Viable but heavier to build and platform-specific; offers no advantage for a personal link manager over a locally-run web app.
  - *Browser extension*: Great for one-click capture (noted as future work in the spec) but a poor fit for browsing/searching a large collection; out of scope for v1.

## 2. Metadata fetching (title + preview)

- **Decision**: Backend fetches the page HTML server-side and extracts, in priority order, Open Graph tags (`og:title`, `og:description`, `og:image`), then Twitter Card tags, then the HTML `<title>` and `<meta name="description">`. Parsing via Cheerio.
- **Rationale**: Open Graph / meta tags are the standard, lightweight source of a page's title, description, and thumbnail — exactly the "short preview" the spec calls for, without archiving the page or taking screenshots (out of scope). Cheerio parses HTML without running a browser, keeping it fast and dependency-light.
- **Fetch discipline**: bounded timeout (~5s), capped response size, a descriptive User-Agent, and following a limited number of redirects. Any failure (timeout, non-HTML, missing tags, unreachable) falls back cleanly (FR-016).
- **Alternatives considered**:
  - *Headless browser (Playwright/Puppeteer) for rendering JS-heavy pages*: Rejected for v1 — far heavier, slower, and unnecessary for the majority of pages that expose OG tags in static HTML. Candidate future enhancement.
  - *Third-party metadata API*: Rejected — adds an external dependency, cost, and a privacy concern (sending every saved URL to a third party) for a personal app.

## 3. Save-vs-fetch decoupling (non-blocking capture)

- **Decision**: Two-step capture. On save, the bookmark is persisted immediately with its address (and any user-entered title); metadata enrichment runs asynchronously and updates the record when it completes. The UI reflects a "fetching…" state and fills in the title/preview when ready, or the fallback if it fails.
- **Rationale**: Directly satisfies FR-016, FR-017, and SC-007 — saving is never blocked by a slow or failing fetch. Keeps the user in control (they can edit the title regardless).
- **Alternatives considered**:
  - *Fetch synchronously before saving*: Rejected — a slow page would trap the user and risk losing the capture, violating SC-007.
  - *Client-side optimistic fetch*: Not possible (CORS, see decision 1).

## 4. Storage & search

- **Decision**: **SQLite** single-file database via `better-sqlite3`, with an **FTS5** virtual table indexing title, address, and note for search.
- **Rationale**: A single-user collection of a few thousand bookmarks fits SQLite comfortably; it is zero-administration, file-based (easy to back up), and persists across restarts (FR-004, SC-005). FTS5 delivers sub-second search over the required scale (FR-006, SC-003) far more simply than hand-rolled `LIKE` scans, and matches across title/address/note in one query.
- **Alternatives considered**:
  - *Plain JSON file*: Rejected — no efficient search/indexing; rewrite-on-every-change risks corruption and does not meet SC-003 gracefully at 1,000+ items.
  - *Client-side storage (IndexedDB/localStorage)*: Rejected — the app already needs a backend for fetching; centralizing persistence there is simpler and avoids browser storage limits.
  - *PostgreSQL/other server DB*: Rejected — operational overkill for a single-user local app.

## 5. Duplicate detection

- **Decision**: Detect duplicates by a **normalized** form of the web address (lowercase scheme/host, strip default ports, strip trailing slash, optionally strip common tracking query params) rather than raw string equality. On a match, warn the user (FR-012) but let them proceed if they choose.
- **Rationale**: Users paste the "same" link in slightly different forms; normalization makes the duplicate warning actually useful. Storing a normalized key alongside the original address enables a fast uniqueness check.
- **Alternatives considered**: *Exact string match* — rejected as too easily fooled by trivial differences. *Fetch-and-compare content* — rejected as far too heavy.

## 6. Tags model

- **Decision**: Tags are their own entity in a many-to-many relationship with bookmarks (join table). Tag names are normalized (trimmed, case-insensitive) so "Work" and "work" are the same tag.
- **Rationale**: Supports assign/remove/filter (FR-008, FR-009) cleanly, avoids duplicate near-identical tags, and lets the UI offer an existing-tag picker.
- **Alternatives considered**: *Comma-separated string on the bookmark* — rejected; makes filtering and tag reuse awkward and error-prone.

## 7. Testing approach

- **Decision**: Vitest for unit (validation, normalization, metadata parsing, services) and integration (API + DB) tests; Playwright for end-to-end coverage of the four user stories.
- **Rationale**: Single language/toolchain across both test tiers; Playwright exercises the real user flows described in the spec's acceptance scenarios, including the async-enrichment UI states.

## Resolved unknowns

All Technical Context items are now concrete; no NEEDS CLARIFICATION markers
remain. The one decision with the most client-visible impact — that v1 is a
**locally-run web app** rather than desktop/mobile — is surfaced explicitly at the
plan review gate for confirmation.
