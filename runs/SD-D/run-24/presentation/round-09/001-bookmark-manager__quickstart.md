# Quickstart & Validation Guide: Bookmark Manager

How to build, run, and validate the feature end-to-end. Implementation details
live in `tasks.md`; entity/API/grammar details are in `data-model.md` and
`contracts/`.

## Prerequisites

- Node.js 24 + npm (image-provided).
- Chromium via Playwright 1.61.0 (shared at `/opt/playwright-browsers`). Pin
  `playwright`/`@playwright/test` to **1.61.0** so the browser revision matches.
- Outbound internet is required for live metadata capture and Internet Archive
  lookups; both degrade gracefully when unavailable.

## Setup (done before review)

```bash
npm install            # root install (server + web workspaces)
npm run build          # builds web/ SPA and compiles server/ TypeScript
```

## Run

```bash
npm start              # starts the prepared server on 0.0.0.0:4000
```

- Review URL: `http://maker:4000` (VM capture uses `http://127.0.0.1:4000`).
- The SPA sets `data-harness-ready="true"` once the initial list (or empty state)
  has loaded.
- `/work/.harness/app.json` declares:
  `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`.

## Automated tests

```bash
npm test               # Vitest unit + integration (parser, normalizeUrl, import/merge, routes)
npm run test:e2e       # Playwright end-to-end journeys (1.61.0)
```

## Manual validation scenarios (map to spec success criteria)

1. **Save with metadata (US1, SC-001)**: Paste an article URL → fetched title,
   description, icon, and preview appear and are editable → save → it shows in the
   list. *Expected*: under ~30s; bookmark persists after reload (SC-003).
2. **No duplicates (US2, SC-004)**: Save the same URL again (also try a trailing
   slash / `utm_` variant) → the existing bookmark opens for editing, no copy is
   created.
3. **Rich search (US4, SC-005)**: Enter `#work AND ("release notes" OR changelog)
   NOT #archive` → results honor the logic. Enter `"rise and fall"` → the word
   `and` is matched literally. Enter `(` → a clear error, no crash.
4. **Tag reuse (US6, FR-015a)**: Start typing an existing tag → it is suggested →
   selecting it applies the existing tag (no near-duplicate).
5. **Read-later (US5, Q2)**: A new save is *not* in the read-later view; mark it
   "read later" → it appears; mark read → it leaves.
6. **Bulk on all matching (US9, SC-006)**: With a multi-page search active, choose
   "apply to all matching" → add a tag → every match across pages is tagged, no
   non-match is.
7. **Archive (US10, SC-007)**: Archive an item → gone from main list & ordinary
   search, present in archive view → restore it → back in the main list.
8. **Saved filter (US11)**: Save a filter combining a search with an included and
   an excluded tag → apply later → same results return.
9. **Preserved copy (US12)**: Open a saved page's local copy (full-page MHTML);
   save a PDF link → the original PDF opens; a Wayback link is offered (or "none
   available / request" when absent).
10. **Import/export round-trip (US13, SC-008)**: Export → re-import the file →
    titles, tags, and saved dates preserved, zero duplicates (non-destructive
    merge).
11. **Preferences (US14)**: Change default sort, page size, and text size →
    reload → preferences remembered and applied.

## Notes on external dependencies

- Internet Archive availability/save and live page capture require network
  access; if unreachable in the review container, the app reports the copy/archive
  as unavailable rather than failing the save. Report such gaps honestly during
  review.
