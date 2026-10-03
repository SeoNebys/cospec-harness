# Phase 0 Research: Bookmark Manager

Decisions that resolve the technical unknowns behind the plan. Format per item:
Decision / Rationale / Alternatives considered.

## 1. Application shape & language

**Decision**: TypeScript everywhere. Fastify HTTP backend serving a React+Vite
single-page app; both in one repository. Backend listens on `0.0.0.0:4000`.

**Rationale**: The runtime environment provides Node.js 24 and expects an HTTP
server on port 4000. TypeScript gives one language across the stack and safe
shared types for the API. Fastify is lightweight, has a built-in logger, and
serves static assets. A SPA suits the interactive needs (advanced search, bulk
selection, tag autocomplete) better than full page reloads.

**Alternatives considered**: Server-rendered templates (simpler, but the rich
client interactions would require ad-hoc JS anyway); Next.js (more framework than
a single-user tool needs, heavier build); Python/Flask (Node keeps Playwright and
the frontend toolchain in one runtime).

## 2. Storage engine

**Decision**: Embedded SQLite via `better-sqlite3`, one file at
`data/bookmarks.db`. Preserved page copies and PDFs live as files under
`data/snapshots/`, referenced by path from the DB.

**Rationale**: Single-user, durable, zero external services, trivially satisfies
"survives reload/restart." SQLite ships FTS5 for full-text search. `better-sqlite3`
is synchronous and fast for this scale, simplifying code. Large binary snapshots
belong on the filesystem, not in DB blobs, to keep the DB small and backups
simple.

**Alternatives considered**: PostgreSQL (needs a server; overkill for one user);
JSON flat files (no real query/search, race-prone); storing snapshots as blobs in
SQLite (bloats DB, slower).

## 3. Full-text search + boolean/tag query model

**Decision**: A hand-written recursive-descent parser turns the query string into
an AST supporting: quoted exact phrases, `#tag` terms, bare text terms, and the
operators `AND`, `OR`, `NOT` with parentheses. `and`/`or`/`not` are operators only
when unquoted; inside quotes they are literal words. The AST compiles to SQL where
text leaves become an FTS5 `MATCH` against a contentless FTS5 table (indexing
title, address, description, note) and `#tag` leaves become tag-membership
`EXISTS` subqueries; boolean nodes become `AND`/`OR`/`AND NOT` combining those
conditions. Implicit adjacency of terms defaults to `AND`.

**Rationale**: FTS5 alone cannot express "tagged X AND text Y" cleanly, and its
own MATCH syntax would leak operator characters to the user. Parsing to an AST
lets us honor the spec's exact rules (FR-012/012a/012b), combine tag and text
conditions correctly, report malformed queries (unbalanced quotes/parens), and
keep search fast by pushing work into SQLite. Case-insensitivity comes from FTS5
tokenization for text and lowercased tag comparison.

**Alternatives considered**: Pass the raw string to FTS5 MATCH (can't combine tag
filters, exposes FTS syntax, mishandles the quoted-operator rule); in-memory
filtering in JS (won't meet <1s at scale and duplicates DB work); a third-party
search engine (unnecessary dependency for one user).

## 4. Metadata capture (title, description, favicon, preview image)

**Decision**: On save, enqueue a background job that fetches the page and extracts
metadata: `<title>`/`og:title`, `meta description`/`og:description`,
`og:image`/`twitter:image` for the preview, and the favicon (link rel icons, else
`/favicon.ico`). Use a plain HTTP fetch + `cheerio` first; fall back to Playmwright
(Chromium) rendering when the page needs JS. Persisted metadata is stored as the
"captured" values; user edits are stored separately and take precedence.

**Rationale**: Most pages expose Open Graph / standard meta tags parseable from
static HTML — fast and cheap. Chromium fallback covers JS-heavy pages. Keeping
captured vs. user-overridden values separate satisfies FR-003 (edit wins) while
preserving what was fetched. Backgrounding keeps save responsive (FR-005, save
never blocks).

**Alternatives considered**: Always render with Chromium (slower, heavier);
never render (misses JS-only pages); third-party metadata API (external
dependency, privacy).

## 5. Page preservation (self-contained snapshot + PDF)

**Decision**: For HTML pages, capture a single self-contained snapshot at save
time using Playwright/Chromium and store it as one HTML file per bookmark
(inlining resources so it renders offline). If the link's content type is PDF,
download and retain the original PDF file as the preserved copy instead. Store
under `data/snapshots/<bookmark-id>/`, referenced by the bookmark row. One
snapshot per bookmark captured at save (no version history — confirmed decision).

**Rationale**: A self-contained file renders independently of the live site
(FR-022) and survives link rot. Detecting PDF by content type and keeping the
file verbatim satisfies "keep a PDF when the link points to one." Filesystem
storage keeps large captures out of the DB.

**Alternatives considered**: MHTML/WARC (WARC needs a special viewer; single-file
HTML is directly viewable); screenshot-only (loses text/searchability of the
page); multiple versions over time (explicitly not wanted).

## 6. Internet Archive submission

**Decision**: Optional, user-triggered per bookmark. POST the URL to the Internet
Archive "Save Page Now" endpoint; on success store the resulting snapshot
reference (archive URL/timestamp) on the bookmark. Best-effort: failures and
offline conditions are reported to the user and never modify the bookmark or its
local preserved copy.

**Rationale**: Matches FR-023 and the confirmed decision that this feature may be
unavailable and must not affect local data. Keeping it user-triggered avoids
hammering the external service on every save.

**Alternatives considered**: Automatic submission on every save (network load,
rate limits, unwanted for private pages); no Internet Archive at all (explicitly
requested).

## 7. Import / export (Netscape bookmark HTML)

**Decision**: Parse and generate the Netscape Bookmark File Format (the
`<DT><A HREF ...>` structure used by browsers) with `cheerio`. On import, map
`HREF`→address, link text→title, `ADD_DATE`→date added, and `TAGS` attribute (and
enclosing folder names as a fallback) → tags. Merge into any existing bookmark
with the same normalized address rather than duplicating. Export produces the same
format, writing tags into the `TAGS` attribute so a round-trip is faithful.

**Rationale**: This is the common, browser-compatible format the spec names
(FR-024/025). `cheerio` already parses HTML for metadata, so no new parser
dependency. Reusing the duplicate-normalization keeps import consistent with
manual save (FR-024 merge; SC-006 no duplicates).

**Alternatives considered**: JSON export only (not browser-compatible); a custom
format (defeats the anti-lock-in goal).

## 8. URL normalization & duplicate detection

**Decision**: Derive a normalized key: lowercase scheme and host, add `http(s)://`
when the scheme is missing, drop a trailing slash on the path, and preserve the
rest. Duplicate detection compares this key (FR-008). Saving an existing key
returns the existing bookmark for editing (FR-007) rather than inserting.

**Rationale**: Matches the spec's stated equivalences (trailing slash, scheme,
host case) without over-normalizing (query strings/paths kept, since they usually
matter).

**Alternatives considered**: Exact string match (misses trivial variants);
aggressive normalization stripping query/fragment (would wrongly merge distinct
pages).

## 9. Background work (capture queue)

**Decision**: A simple in-process FIFO queue with limited concurrency runs
metadata capture, snapshot capture, and (when requested) Internet Archive
submission after the bookmark row is created. Each bookmark exposes a capture
status (pending/ready/failed per artifact) the UI can reflect.

**Rationale**: Keeps save responsive (FR-005/SC-001), needs no external broker for
one user, and gives clear per-artifact status for the "metadata unavailable"
indication.

**Alternatives considered**: Synchronous capture on save (slow, blocks on
unreachable sites); external job queue/Redis (unneeded infrastructure).

## 10. Formatted notes

**Decision**: Store notes as markdown text; render with a markdown renderer plus
HTML sanitization on display. Limited to lightweight formatting (headings,
bold/italic, lists, links) per the confirmed decision.

**Rationale**: Portable, plain-text-storable, searchable as raw text via FTS,
matches the confirmed "markdown-style is enough." Sanitizing prevents injection
from imported/edited content.

**Alternatives considered**: Rich-text/HTML WYSIWYG (heavier, not required);
plain text only (loses requested formatting).

## 11. Testing approach

**Decision**: Vitest for units (search parser, URL normalize, import/export,
metadata parse) and integration (API routes against a temp SQLite file).
Playwright Test pinned to 1.61.0 for a few end-to-end UI flows (save → appears in
list → search → open). Use the shared Chromium at `/opt/playwright-browsers`; do
not download another browser.

**Rationale**: Pure logic (parser, normalization, import) carries the correctness
risk and is cheap to unit-test. A thin e2e layer validates the primary journeys.
Pinning matches the installed browser revision per the environment rules.

**Alternatives considered**: E2E-only (slow, poor coverage of parser edge cases);
no e2e (misses integration/UI regressions).
