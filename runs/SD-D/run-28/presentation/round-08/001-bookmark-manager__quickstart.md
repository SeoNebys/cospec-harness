# Quickstart & Validation: Bookmark Manager

How to run the app and validate that the spec's primary journeys work. Assumes the
shared image (Node.js 24, Playwright 1.61.0 + Chromium at
`/opt/playwright-browsers`). No code here — see [contracts/](./contracts/) and
[data-model.md](./data-model.md) for details.

## Prerequisites

- Node.js 24 + npm.
- Playwright browsers already present at `/opt/playwright-browsers` (do not
  download another revision).
- Outbound internet for metadata capture and Internet Archive (features degrade
  gracefully without it).

## Install, build, run

```bash
npm install            # installs backend + frontend workspaces (lockfile preserved)
npm run build          # builds the React frontend and compiles the backend
npm start              # starts Fastify on 0.0.0.0:4000, serving API + built SPA
```

- Application (final): `http://maker:4000` (VM capture uses `http://127.0.0.1:4000`).
- The runtime broker starts `npm start` from `/work` per `.harness/app.json`.
- Data persists under `data/` (`bookmarks.db`, `snapshots/`).
- The main UI sets `data-harness-ready="true"` once the initial list (or empty
  state) has loaded.

## Validation scenarios (map to acceptance criteria)

1. **Save with auto metadata (US-1)**: Add a reachable URL → it appears with a
   captured title, description, favicon, and preview once capture completes;
   reload → it persists. Edit title/description → overrides shown.
2. **Duplicate → edit (US-2)**: Save the same URL again → no duplicate; you land
   on the existing bookmark in edit mode. Try trailing-slash/scheme/case variants
   → treated as the same.
3. **List display + open (US-3)**: Each row shows title, description, tags, and
   favicon; activating a row opens the original link in a new tab.
4. **Advanced search (US-3)**: Run `#work AND ("quarterly report" OR budget) NOT draft`
   → only correct matches. Confirm `"rock and roll"` treats `and` as a word.
   Unbalanced quotes/parens → clear error. Change sort → list reorders.
5. **Read later (US-5)**: Mark unread → appears in the unread view; mark read →
   leaves it.
6. **Archive (US-6)**: Archive → hidden from normal list, present in archive view;
   restore → returns.
7. **Tags + suggestions (US-7)**: Typing a used tag prefix suggests it; filter by
   tag shows only tagged items.
8. **Notes (US-8)**: Add a markdown note → formatting renders and persists; search
   finds text in it.
9. **Bulk actions (US-9)**: Select all matching a search → add a tag in one action
   → all matches carry it. Bulk delete asks for confirmation.
10. **Saved views (US-10)**: Save a query + include/exclude tags as a view →
    reopen → expected results.
11. **Preservation (US-11)**: Open a bookmark's preserved copy → renders from
    stored content; a PDF link retains the PDF; Internet Archive submission stores
    a reference (or reports failure without touching the bookmark).
12. **Import/export (US-12)**: Import a browser bookmark HTML file → titles, tags,
    dates preserved, no duplicates; export → re-imports faithfully.
13. **Preferences (US-13)**: Change default sort, item count, text size → reload →
    still applied.

## Automated checks

```bash
npm test               # Vitest units (search parser, url-normalize, import/export, metadata) + route integration
npm run test:e2e       # Playwright (pinned 1.61.0) primary-journey checks
```

Expected: search-parser and import/export unit suites green (highest-risk logic);
integration suite exercises the API against a temporary SQLite DB; e2e covers
save → list → search → open.
