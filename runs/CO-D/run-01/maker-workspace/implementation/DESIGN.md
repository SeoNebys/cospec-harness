# Design record & scenario-to-code map

Cycle 1. Kept lightweight but sufficient for later-cycle impact analysis and for
regenerating traditional docs if asked (per development.md).

## Structure

```
implementation/
  index.html            # app shell + styles
  app.js                # DOM wiring, persistence, event handling (presentation)
  src/core/             # pure domain logic (no DOM) — the tested heart
    url.js              # scheme, validity, duplicate key
    labels.js           # labels, reuse discipline, folder→labels
    search.js           # search across fields, word-variation matching
    sort.js             # newest/oldest/title
    store.js            # collection + the single duplicate-enforcement point
    copy.js             # saved-copy status & honesty rules
    imports.js          # import (parse+apply) and export
  src/services/
    pageService.js      # SEAM to the outside world (fetch/snapshot) — stubbed
  test/                 # node:test suite (40 tests)
```

Principle: **all rules live in `src/core` (pure, tested); `app.js` is only
presentation + events; anything needing a server is behind `pageService.js`.**
This keeps the client's "invisible discipline" features in tested pure code.

## Design decisions (and dropped alternatives)

1. **Duplicate key includes the query string** (`url.js: dedupeKey`).
   Approved same-page rules (SCN-004): ignore `www.` and a trailing `/`.
   *Dropped:* the prototype's host+path-only key — it collapsed `?id=1` and
   `?id=2` into one page. Tracking-param (`?utm`) normalization is PARKED, so
   query strings stay significant for now. Duplicate detection is enforced in
   **one place** (`Store.save`), so it holds for both direct saves and imports.

2. **Word-variation search = light suffix stemmer + small irregular map**
   (`search.js`). Approved behaviour needs "Rome"→"Roman" but NOT "Romania".
   *Dropped:* a pure Porter stemmer (would not unify Rome/Roman, a place/demonym
   pair); *dropped:* prefix matching (would drag in "Romania"). Irregular pairs
   live in an extensible `IRREGULAR` map; general forms (cook/cooking,
   recipe/recipes, plurals) are handled by suffix stripping.

3. **Read-later is an independent flag, not a label** (SCN-008) — "I mean to
   read this" is not a topic. A link can be flagged and labelled at once.

4. **Delete confirms once; duplicate-save never nags** (SCN-012 vs SCN-004) —
   the confirmation is reserved for the destructive, permanent action.

5. **Saved-copy honesty is explicit state** (`copy.js`): `kind` ∈
   pending/text/pdf/**none**; `dead` flag. `savedCopyView` never reports
   protection for `none`. This encodes the "never a false promise" priority.

6. **Import at the domain uses a simple line format**; parsing a browser's
   exported bookmarks HTML file is an edge concern for the real build. Malformed
   rows are counted and skipped, never abort the import (day-one robustness).

7. **Persistence via `localStorage` for now**, wrapped so it fails quietly.
   Cross-device sync (the "reach it anywhere" goal) is a backend concern that
   slots behind the store; not built this cycle.

8. **`pageService` is a client-side stub** simulating title/summary/snapshot so
   the app runs from a file. Replace with a backend call in production; the app
   is written against the interface and won't change.

## Scenario → code map

| SCN | What | Primary code | Tests |
|-----|------|--------------|-------|
| 001 | Save fast, auto title/summary | store.js `save`, app.js `saveNew`, pageService | store, url |
| 002 | Open a saved link | app.js `openBookmarkCard`, copy.js `clickOpens` | copy |
| 003 | Quick rename in place | app.js `startRename/commitRename` | (journey) |
| 004 | No duplicate saves | url.js `dedupeKey`, store.js `save` | url, store |
| 005 | Search title/summary/note/address | search.js | search |
| 006 | Labels + reuse discipline | labels.js | labels |
| 007 | Browse by label | app.js label filter + `renderLabelBar` | (journey) |
| 008 | Read-later pile | app.js `toggleToRead/markRead`, tabs | journey |
| 009 | Auto saved copy + dead fallback + honesty | copy.js, pageService | copy |
| 010 | PDF saved copy keeps the file | copy.js, pageService `isPdf` | copy |
| 011 | Full edit incl. searchable note | app.js `openEdit/saveEdit`, search.js | search |
| 012 | Delete with one confirmation | store.js `remove`, app.js edit modal | store |
| 013 | Import: folders→labels, dedupe, dates | imports.js, labels.js, store.js | imports, journey |
| 014 | Export take-anywhere | imports.js `exportText` | imports |
| 015 | Sort newest/oldest/title + dates | sort.js | sort |
| 016 | Bulk actions | app.js bulk*, store.js `removeMany`, labels.js | store, journey |

## Parked (not implemented this cycle — see context/goals.md)

utm normalization · boolean/exclude/OR search · quoted phrase · note formatting ·
external web-archive backstop · undo label removal · sort by recently-opened ·
browser extension quick-save · combine labels in one view · real favicons (polish).
