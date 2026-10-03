# Phase 0 Research: Bookmark Manager

All Technical Context items are resolved — no remaining NEEDS CLARIFICATION.
Decisions below are recorded with rationale and rejected alternatives.

## 1. Application architecture — single Node deployable

- **Decision**: One Node.js 24 process using Express 5 that both serves the
  JSON API and hosts the static frontend from `public/`.
- **Rationale**: Matches the single-user/single-device v1 scope and the
  runtime delivery model (one server on `0.0.0.0:4000`, reached at
  `http://maker:4000`). No build step, no separate frontend server, minimal
  moving parts.
- **Alternatives considered**:
  - *Separate SPA (React/Vite) + API*: adds a build pipeline and a second
    served origin for no v1 benefit at this scale. Rejected (YAGNI).
  - *Serverless/functions*: background enrichment and a local SQLite file fit a
    single long-lived process far better. Rejected.

## 2. Metadata enrichment must be server-side

- **Decision**: Fetch the target page's HTML from the server and parse metadata
  there; never fetch arbitrary third-party pages from the browser.
- **Rationale**: Browser same-origin/CORS policy blocks reading arbitrary
  cross-origin page HTML, so client-side enrichment is not viable. The server
  has outbound access and no CORS restriction.
- **Alternatives considered**: Third-party metadata/unfurl API — adds an
  external dependency and a key; unnecessary for personal scale. Rejected for
  v1.

## 3. Background (choice A) enrichment model

- **Decision**: On `POST /bookmarks`, validate + persist the bookmark with
  `enrichment_status = "pending"` and return `201` immediately. A fire-and-
  forget async task then fetches metadata and updates the row to `ready` (or
  `failed`). The frontend shows the new bookmark at once and polls (or re-lists)
  until its status leaves `pending`, then renders the fetched details.
- **Rationale**: Directly implements the client-approved choice A — saving is
  instant, details fill in later. Keeps SC-007 (saving never hangs) trivially
  true because the response never awaits the fetch.
- **Alternatives considered**:
  - *Synchronous fetch before responding (choice B)*: explicitly rejected by
    the client.
  - *Durable job queue (BullMQ/Redis)*: over-engineered for one user on one
    device; an in-process async task is sufficient. Rejected (YAGNI).
  - *Server-Sent Events / WebSocket push*: nicer UX but heavier; short-interval
    polling of the list is adequate at personal scale. Deferred as a possible
    enhancement.

## 4. Metadata extraction fields & precedence

- **Decision**: Parse HTML with **cheerio** and extract, in order of
  preference:
  - **Title**: `og:title` → `<title>` → derived from URL host/path.
  - **Description**: `og:description` → `<meta name="description">` → empty.
  - **Preview image**: `og:image` → `twitter:image` → none.
  - **Favicon**: `<link rel="icon"|"shortcut icon">` (resolved to absolute) →
    fallback `/{origin}/favicon.ico`.
  - Relative URLs are resolved against the page's final URL.
- **Rationale**: Open Graph is the de-facto standard for previews; the listed
  fallbacks cover pages that omit it. Cheerio gives robust, well-known
  server-side HTML parsing without a headless browser.
- **Alternatives considered**: Regex scraping (brittle with real-world HTML,
  rejected); headless-browser rendering via Playwright (heavy, unnecessary for
  static meta tags, rejected for enrichment — Playwright stays for e2e tests).

## 5. Bounded fetch — timeout & safety

- **Decision**: Use Node's global `fetch` with an `AbortController` and an **8 s
  timeout**; cap the downloaded HTML (e.g. first ~512 KB) and only parse
  `text/html` responses. On timeout, non-2xx, network error, or non-HTML
  content, mark the bookmark `failed` and keep the URL-derived title +
  placeholders. Send a realistic `User-Agent`.
- **Rationale**: Satisfies FR-004b and SC-007. Byte cap and content-type check
  avoid pathological pages. Because enrichment is off the request path, the
  timeout affects only how soon details appear, never the save.
- **Alternatives considered**: No timeout (could hang enrichment indefinitely,
  rejected); unlimited body read (memory risk, rejected).

## 6. Storage — embedded SQLite

- **Decision**: Persist to a local SQLite file (`data/bookmarks.db`) via
  **better-sqlite3**. Store favicon/preview as remote URL strings (references),
  not binary blobs, for v1. Tags stored in a join table.
- **Rationale**: File-based DB gives the required persistence across restarts on
  one device with zero external services (SC-004). better-sqlite3 is synchronous
  and simple, ideal for personal scale. Referencing image URLs avoids blob
  storage complexity.
- **Alternatives considered**:
  - *JSON file*: no indexed search, concurrency-fragile. Rejected.
  - *Server DB (Postgres/MySQL)*: needs an external service, contradicts
    single-device simplicity. Rejected for v1.

## 7. Search & tag filtering

- **Decision**: Case-insensitive substring match over title + address +
  description for keyword search; tag filter via the join table. Applied as SQL
  `WHERE` clauses with parameters; results ordered by `date_saved DESC`.
- **Rationale**: Simple, predictable, fast at personal scale (SC-002). Avoids
  full-text-index complexity for a few thousand rows.
- **Alternatives considered**: SQLite FTS5 — more power than needed now; can be
  added later without schema-breaking changes. Deferred.

## 8. Duplicate-address handling

- **Decision**: Normalize the address (see URL rules) and look up an existing
  bookmark with the same normalized URL before inserting. If found, the API
  returns a signal (e.g. `409` with the existing bookmark's id) and the UI opens
  that bookmark's edit view instead of creating a duplicate (FR-011).
- **Rationale**: Implements the client's explicit request to route to editing
  the existing item rather than warn.
- **Alternatives considered**: Silent warning only (previous spec behavior,
  superseded); allow duplicates (rejected — clutters the collection).

## 9. URL validation & normalization

- **Decision**: Accept scheme-less input by defaulting to `https://`; validate
  via the WHATWG `URL` parser; require an `http`/`https` protocol and a host.
  Normalize for dedupe by lowercasing scheme+host, removing a trailing slash on
  empty paths, and dropping a default port. Preserve the user's path/query.
- **Rationale**: Satisfies FR-002/FR-003 and gives a stable key for FR-011
  dedupe.
- **Alternatives considered**: Regex URL validation (error-prone, rejected in
  favor of the platform `URL` parser).

## 10. Testing strategy

- **Decision**: `node:test` for unit (URL rules, metadata parsing from fixture
  HTML with no network) and integration (API against an in-process app with a
  temporary DB, enrichment stubbed/injected). Playwright **1.61.0** for one e2e
  happy-path across save → immediate appearance → enrichment fills in → search →
  edit → delete.
- **Rationale**: Pinned Playwright matches the preinstalled browser revision per
  runtime guidance. Injecting the metadata fetcher keeps tests deterministic and
  offline.
- **Alternatives considered**: Hitting the live internet in tests (flaky,
  rejected); no e2e (misses the background-fill UX, rejected).
