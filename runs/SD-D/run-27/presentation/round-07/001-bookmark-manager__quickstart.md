# Quickstart & Validation: Bookmark Manager

This guide proves the feature works end-to-end. It references the
[API contract](./contracts/api.md) and [data model](./data-model.md) rather than
duplicating them. Implementation code lives in the source tree and tasks.

## Prerequisites

- Node.js 24 + npm (provided by the image).
- Bundled Playwright 1.61.0 + Chromium at `/opt/playwright-browsers`
  (`PLAYWRIGHT_BROWSERS_PATH` already points there).
- Outbound network for metadata fetch, page preservation, and Internet Archive
  (these degrade gracefully when unavailable).

## Setup

```bash
cd /work
npm install            # installs server + client deps; keep lockfile intact
npm run build          # builds the React client to static assets
npm start              # starts Express on 0.0.0.0:4000
```

`npm start` must serve the SPA and API on port 4000. The runtime broker starts
this command when the port is not already listening; `.harness/app.json` declares
it (`kind: application`, port 4000, `start_command: ["npm","start"]`).

Review URL: `http://maker:4000`. The page sets `data-harness-ready="true"` once the
initial view and data load (including a valid empty state).

## Validation scenarios (map to spec user stories)

1. **Save with metadata (US1)** — POST a valid URL; confirm the created bookmark
   has fetched title/description/icon/preview; edit title/description and confirm
   persistence. Save an unreachable/blocked URL; confirm it is still created with
   `metadata_status: failed` and a retry option.
2. **No duplicates (US2)** — POST the same URL twice; confirm the second call
   returns the existing bookmark (`duplicate: true`) and no second row. Confirm
   `http://Example.com:80/` and `http://example.com/` collapse, but a trailing
   slash or `?utm_...` variant stays distinct.
3. **Editable fields + note formatting + tag suggest (US3)** — PATCH address,
   title, tags, description, note (Markdown); confirm persistence and that the note
   renders formatted; GET /api/tags?prefix= returns suggestions.
4. **Advanced search (US4)** — run `#work AND (report OR "quarterly review") NOT draft`
   and confirm correct results; run `"AND"` and confirm literal matching; send an
   unbalanced-parenthesis query and confirm a 400 bad_query.
5. **Read-later (US5)** & **Archive (US6)** — mark read-later, view the list, mark
   read; archive/restore and confirm main-list membership and retained states.
6. **Bulk actions (US7)** — select ids and "select all matching"; apply add_tags +
   archive; confirm affected count and that only matching items changed.
7. **Sort & display (US8, US12)** — change sort and confirm reorder; each list item
   shows title, description, tags, icon; change preferences, reload, confirm persist.
8. **Saved searches (US9)** — save a query + include/exclude tags; reopen it and
   confirm the same results; rename/delete.
9. **Import/export (US10)** — POST a Netscape bookmark file; confirm titles, tags
   (incl. folders→tags), and ADD_DATE are preserved and the added/skipped/failed
   summary is accurate; GET /api/export and re-import the output.
10. **Preservation (US11)** — preserve a web page and reopen the stored
    self-contained HTML offline; preserve a PDF link and confirm a `.pdf` is stored;
    request Internet Archive and confirm a snapshot reference (or a graceful
    failure message when offline).

## Automated checks

```bash
npm test               # node:test unit + contract suites
npm run test:e2e       # Playwright 1.61.0 smoke flows (save, search, bulk)
```

Unit suites must cover: URL normalization (safe-equivalence only), the boolean
query parser (precedence, quoted-literal operators, malformed input), Netscape
import/export (title/tags/ADD_DATE), and note sanitize/render.

## Persistence check (SC-007)

Create bookmarks, tags, a saved search, and change preferences; stop and restart
`npm start`; confirm all data (including read/archive states and preserved-copy
references) is intact.
