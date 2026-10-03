# Quickstart & Validation Guide: Bookmark Manager

Validates the feature end-to-end. Details of endpoints and fields live in
[contracts/api.md](./contracts/api.md), [contracts/search-grammar.md](./contracts/search-grammar.md),
and [data-model.md](./data-model.md); this guide is how to run and verify.

## Prerequisites

- Node.js 24 and npm (from the image)
- Playwright pinned to `1.61.0`; browsers shared at `/opt/playwright-browsers`
  (do not download another browser revision)

## Setup

```bash
cd /work
npm install            # installs pinned deps; preserves package-lock.json
npm run migrate        # creates data/bookmarks.db schema (if separate from start)
```

## Run

```bash
npm start              # starts Express on 0.0.0.0:4000
```

- App is reached by the client at `http://maker:4000`; VM capture uses
  `http://127.0.0.1:4000`.
- `.harness/app.json` declares:
  `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}`.
- The primary UI element gets `data-harness-ready="true"` after initial UI + data
  load (including a valid empty state).

## Test

```bash
node --test                       # unit: search parser, metadata, import/export, notes
npx playwright test               # e2e journeys (playwright pinned 1.61.0)
```

## Validation scenarios (trace to spec)

1. **Save with metadata (US1)**: Add a URL with OG tags → item shows fetched
   title, description, favicon, preview; list row shows title/description/tags/icon.
   Edit title & description both in the save form and afterward.
2. **Open & note (US2)**: Add a Markdown note → it renders formatted and persists;
   selecting the bookmark opens the original in a new tab.
3. **Edit-on-duplicate (US3)**: Re-save an existing URL → existing bookmark opens
   for editing; no duplicate created.
4. **Advanced search (US4)**: Verify each row of the worked-examples table in
   search-grammar.md, including implicit-AND (`python #news`), explicit `OR`,
   quoted `"AND"` as literal, grouped booleans, and a malformed-query error.
5. **Tag suggestions & uniqueness (US5)**: Type an existing tag prefix → suggested;
   typing an existing name (not selecting) reuses it — no duplicate.
6. **Read-later (US6)**: Mark unread → appears in unread view; mark read → leaves it.
7. **Archiving (US7)**: Archive → gone from normal list & default search, present
   in archive view; restore → returns.
8. **Bulk actions (US8)**: Multi-select and "select all in results"; add tag,
   mark read, archive, delete apply to the whole selection (one confirm to delete).
9. **Sorting (US9)**: Switch among newest/oldest/title/updated; default respects
   preference.
10. **Saved filters (US10)**: Save a named filter (terms + include/exclude tags),
    apply it, delete it.
11. **Import/export (US11)**: Import a browser bookmark HTML file (titles, tags,
    dates preserved; existing URLs merged); export and confirm round-trip (SC-006).
12. **Page copies (US12)**: Save a self-contained local copy of an HTML page →
    opens offline; a PDF URL is preserved as PDF; Internet Archive submission
    records a snapshot link, and a failure is reported without harming the bookmark.
13. **Display preferences (US13)**: Change default sort, page size, text size →
    effects apply and persist across restart.

## Expected outcomes (success criteria)

- Save a bookmark in < 20 s (SC-001); find one among 500+ in < 10 s (SC-002);
  search feels instant at 500+ (SC-003).
- Nothing lost across restart (SC-005); export→import preserves 100% of titles,
  tags, dates with no duplicates (SC-006); a preserved copy still opens after the
  original changes/disappears (SC-007).
