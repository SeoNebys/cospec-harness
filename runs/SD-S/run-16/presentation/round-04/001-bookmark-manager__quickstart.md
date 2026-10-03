# Quickstart & Validation Guide: Bookmark Manager

How to run the app and validate it end-to-end. Details of endpoints live in
[contracts/api.md](./contracts/api.md); data shapes in
[data-model.md](./data-model.md). No implementation code is duplicated here.

## Prerequisites

- Node.js 24 and npm (provided by the runtime image).
- Outbound internet access (for live metadata enrichment; the app still works
  without it, degrading gracefully per FR-004b).
- Playwright 1.61.0 pinned in devDependencies (matches preinstalled browsers).

## Setup

```bash
npm install          # install Express, better-sqlite3, cheerio, and dev deps
npm start            # starts the server on 0.0.0.0:4000
```

The SQLite file `data/bookmarks.db` is created automatically on first run.
Open the app at `http://maker:4000` (review environment) — do not use
`localhost` for the client.

## Runtime delivery marker

The app is presentation-ready when the primary UI container has
`data-harness-ready="true"`, set after the initial bookmark list (or empty
state) loads. `.harness/app.json` declares:

```json
{"kind": "application", "port": 4000, "path": "/", "start_command": ["npm", "start"], "start_cwd": "/work"}
```

## Validation scenarios (map to spec acceptance criteria)

1. **Save is immediate, details fill in later (US1 / FR-004, choice A)**
   - Add a real URL (e.g. `example.com`).
   - Expect: the bookmark appears at the top of the list *at once* with a
     URL-derived title and a "fetching details…" indicator
     (`enrichmentStatus: pending`).
   - Within a few seconds it updates in place to the real title, description,
     favicon, and preview image (`ready`).

2. **Graceful fallback (US1 / FR-004b, SC-007)**
   - Add an unreachable/invalid-content URL (e.g. a made-up host).
   - Expect: the bookmark is still created and never blocks; status settles to
     `failed`, keeping the URL-derived title and placeholder image. Saving does
     not hang.

3. **Invalid address rejected (US1 / FR-002, SC-005)**
   - Submit `not a url`.
   - Expect: `400 invalid_url`, a clear inline message, no bookmark created.

4. **Browse, search, open (US2 / FR-005, FR-007, FR-006)**
   - With several bookmarks saved, type a keyword.
   - Expect: list narrows to title/url/description matches; a no-match keyword
     shows the empty-results state (FR-008); clicking a bookmark opens the
     original page in a new tab.

5. **Tags filter (FR-014)**
   - Assign tags on add/edit; select a tag.
   - Expect: list shows only bookmarks with that tag; `GET /api/tags` lists
     known tags.

6. **Edit & delete (US3 / FR-009, FR-010)**
   - Edit a bookmark's title/description; reload — changes persist.
   - Delete a bookmark; confirm the confirmation prompt; it disappears and does
     not return on reload.

7. **Duplicate routes to edit (FR-011)**
   - Save an address that already exists.
   - Expect: instead of a duplicate, the app opens the existing bookmark's edit
     view (`409` with the existing bookmark).

8. **Persistence across restart (FR-012, SC-004)**
   - Stop and restart the server.
   - Expect: all bookmarks remain and remain openable.

## Automated checks

```bash
npm test                 # node:test unit + integration (offline; enrichment injected)
npx playwright test      # e2e happy path against the running app (Playwright 1.61.0)
```

Unit/integration tests inject a stub metadata fetcher so they run offline and
deterministically. The e2e test drives save → immediate appearance → background
fill → search → edit → delete.
