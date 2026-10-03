# Phase 0 Research: Bookmark Manager

All Technical Context items are resolved below. Decisions favour the tools
already provided by the shared image (Node.js 24, Python, Playwright 1.61.0 +
Chromium) and a small dependency footprint for reliability in the review
environment.

## 1. Application shape and runtime

- **Decision**: Single Node.js application using Express to both serve a static
  vanilla-JS single-page UI and expose a JSON HTTP API, listening on
  `0.0.0.0:4000`. `npm start` runs the prepared server in the foreground.
- **Rationale**: The spec is a single-user, local, browser app with no separate
  services. One deployable is simplest and matches the harness manifest
  (`kind: application`, port 4000, `start_command: ["npm","start"]`).
- **Alternatives considered**: A heavier SPA framework (React/Vue) — rejected to
  keep the lockfile and browser check simple; a static-only prototype — rejected
  because server-side metadata fetch and page preservation need a backend.

## 2. Local storage

- **Decision**: SQLite via `better-sqlite3`, one file at `data/bookmarks.db`.
  Preserved page files live under `data/preserved/`.
- **Rationale**: Durable local persistence (satisfies FR-028/SC-003), relational
  model fits bookmarks/tags/saved-searches, synchronous API keeps handlers
  simple for a single user, no external DB service to provision.
- **Alternatives considered**: JSON flat files — rejected (no indexing, risky
  concurrent writes); an external DBMS — rejected (violates local-only, adds
  ops); browser localStorage — rejected (server owns metadata/preservation and
  data must survive independent of any one browser).

## 3. Metadata extraction (title, description, icon, preview)

- **Decision**: Server fetches the target URL and parses HTML with
  `node-html-parser`, reading `<title>`, `<meta name="description">`, OpenGraph
  (`og:title`, `og:description`, `og:image`) and Twitter-card fallbacks, and
  `<link rel="icon">`/favicon. Missing pieces fall back (derived title from
  host/path; default icon/preview placeholders). Fetch has a timeout.
- **Rationale**: Satisfies FR-002/FR-004 without a headless browser for the
  common case; graceful degradation is required by the spec edge cases.
- **Alternatives considered**: Headless render for every save — rejected as too
  slow/heavy for metadata; third-party metadata APIs — rejected (external
  dependency, privacy, local-only intent).

## 4. Address normalisation & duplicate detection

- **Decision**: A `normalize.js` producing a canonical key: lowercase scheme and
  host, strip default ports, remove a trailing slash on the path, drop common
  tracking query params (e.g. `utm_*`, `fbclid`, `gclid`), and sort remaining
  query params. Duplicate detection compares canonical keys.
- **Rationale**: Satisfies FR-006 and the trailing-slash/host-case edge case;
  re-saving opens the existing bookmark rather than duplicating (US2).
- **Alternatives considered**: Exact string match — rejected (misses trivial
  variants); full URL semantic equivalence — rejected as over-engineered for v1.

## 5. Search grammar (the exacting part)

- **Decision**: A hand-written tokenizer + recursive-descent parser producing an
  expression tree, then an evaluator run against candidate rows. Grammar rules,
  matching the spec:
  - **Tokens**: quoted phrase (`"..."`), tag term (`#tag`), bare word, and the
    operators `AND`, `OR`, `NOT`, `(`, `)`.
  - **Operators are only operators when unquoted**; inside quotes `AND/OR/NOT`
    are literal text (FR-014, US4 scenario 5).
  - **Adjacent terms with no operator** are combined with an **implicit AND**,
    including a `#tag` next to a bare word (FR-014, US4 scenario 3).
  - **Precedence**: `NOT` > `AND` (incl. implicit) > `OR`; parentheses override.
  - **Matching**: bare word / phrase match is case-insensitive across title,
    description, note (as plain text), and address; `#tag` matches the tag set.
  - **Malformed queries** (unbalanced quotes/parens) yield a clear, non-
    destructive message (US4 scenario 8), not a crash.
- **Rationale**: The operator/implicit-AND/quoted-literal semantics are precise
  and not expressible cleanly in a generic full-text query; a dedicated parser
  makes them testable in isolation. At thousands of rows, evaluating in memory
  after a cheap pre-filter is well within the 10 s / sub-second target.
- **Alternatives considered**: SQLite FTS5 `MATCH` — rejected: its boolean/near
  syntax and tokenisation do not match the required implicit-AND and
  quoted-operator rules; would need translation anyway. A generic query library
  — rejected for the same semantic-fidelity reason.

## 6. Rich note formatting

- **Decision**: A `contenteditable` editor in the browser with a small toolbar
  (bold, italic, lists, links). Notes are stored as HTML, **sanitised with
  `sanitize-html`** on save to an allow-list (b/strong, i/em, ul/ol/li, a, p,
  br). Unsupported formatting is dropped, keeping readable text (edge case).
  Rendering re-sanitises defensively before display.
- **Rationale**: Satisfies FR-008 and the "unsupported formatting dropped
  safely" edge case; sanitisation prevents stored-XSS from note or fetched
  metadata content.
- **Alternatives considered**: A Markdown editor — viable but the spec says
  "basic formatting … display that formatting", and WYSIWYG is closer to intent;
  a heavy rich-text library — rejected for footprint.

## 7. Tag suggestions

- **Decision**: Server exposes distinct existing tags with usage counts; the tag
  input filters them as the user types (prefix/substring match), most-used
  first.
- **Rationale**: Satisfies FR-009 with data already present; no ML needed.
- **Alternatives considered**: Fuzzy matching — deferred as unnecessary for v1.

## 8. Read-later, archive, delete semantics

- **Decision**: `is_unread` and `is_archived` boolean flags per bookmark. New
  bookmarks are **read** unless "read later" is chosen at save (FR-016).
  Archived rows are excluded from normal list and normal search; a dedicated
  archive view queries archived rows; restore clears the flag (FR-017). Delete
  requires an explicit confirm step and is permanent (FR-018).
- **Rationale**: Simple, matches the corrected spec exactly.
- **Alternatives considered**: A single lifecycle enum — rejected because a
  bookmark can be simultaneously unread and (later) archived; independent flags
  are clearer.

## 9. Bulk actions

- **Decision**: Bulk endpoint accepts either an explicit id list or a "current
  query" descriptor (search string + included/excluded tags) resolved
  server-side to the matching set. Tag bulk operations are expressed as **add
  tags** / **remove tags** deltas that never replace a bookmark's other tags
  (FR-019). Partial failures are collected and reported per item (FR-020).
- **Rationale**: Matches corrected spec; delta semantics prevent the accidental
  tag-replacement the client called out.
- **Alternatives considered**: "Set tags" replace semantics — explicitly
  rejected by the client.

## 10. Saved searches

- **Decision**: Persist named records of `{ query, includedTags[],
  excludedTags[] }`; selecting one reapplies all three; rename/delete supported
  (FR-021).
- **Rationale**: Direct mapping of US9.

## 11. Import / export (Netscape bookmark HTML)

- **Decision**: `netscape.js` parses and emits the Netscape
  bookmark file (the `<DT><A HREF ADD_DATE ... TAGS>` format browsers use).
  Export writes titles, `ADD_DATE`, and `TAGS` attributes; import reads them,
  applies duplicate detection (FR-023), and defaults missing fields. Invalid
  files import nothing and report clearly.
- **Rationale**: Satisfies FR-022/FR-023 and the client's confirmed format;
  `TAGS`/`ADD_DATE` are the conventional attributes carried by this format.
- **Alternatives considered**: JSON or CSV — rejected; client wants the standard
  browser format for interoperability.

## 12. Local page preservation (self-contained HTML; PDFs as PDFs)

- **Decision**: `preserve.js` fetches the URL and inspects content type. For
  **PDF** responses, store the bytes as a `.pdf` file. For **HTML** pages, load
  the page in headless Chromium (Playwright, pinned 1.61.0, using the shared
  `/opt/playwright-browsers` binaries), inline external resources (CSS, images
  as data URIs, fonts) and serialise to a **single self-contained `.html`
  file**, sanitised of scripts. Files are stored under `data/preserved/` and
  referenced from the bookmark; openable offline from the app (FR-024, US11).
- **Rationale**: Self-contained HTML (client's stated requirement) survives link
  rot and opens without the origin; Playwright is already installed and pinned
  per the image guidance, avoiding a second browser download.
- **Alternatives considered**: MHTML — less portable/openable than inlined HTML;
  a separate resource folder — rejected, not self-contained; the Python
  `monolith`/`single-file` CLIs — not guaranteed present, so we build capture on
  the provided Playwright.

## 13. Optional Internet Archive submission

- **Decision**: `archiveOrg.js` submits the URL to the Internet Archive "Save
  Page Now" endpoint on request, records the returned snapshot reference on the
  bookmark, and on any failure/unavailability keeps the bookmark saved and
  informs the user (FR-025/FR-026, US11 scenario 4).
- **Rationale**: Direct mapping; the spec requires graceful degradation for this
  external service. Availability of the external service is reported honestly.
- **Alternatives considered**: Mandatory archiving — rejected (spec says
  optional, service may be unreachable).

## 14. Preferences & session

- **Decision**: Single preferences record (default sort order, items per view,
  text size) persisted and applied on load (FR-027). An HTTP session cookie
  identifies the single local user for the review environment; production
  hardening kept separate per the harness note.
- **Rationale**: Matches US12 and the harness cookie requirement.

## 15. Testing approach

- **Decision**: `node:test` unit suites for the pure logic with the highest bug
  risk — search grammar, address normalisation, Netscape import/export, metadata
  parsing. A small Playwright smoke test confirms the app loads, a bookmark can
  be saved, and it renders. Playwright pinned to 1.61.0 to match installed
  browsers.
- **Rationale**: Concentrates automated testing on the exacting, spec-defined
  logic; keeps a lightweight end-to-end sanity check for presentation readiness.

## Resolved unknowns

No `NEEDS CLARIFICATION` markers remain. All Technical Context fields are
concrete.
