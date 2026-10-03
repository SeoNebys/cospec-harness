# Bookmark Manager

A single-user, private, browser-based app to save and manage bookmarks. Built
with Spec-Driven Development — see `specs/001-bookmark-manager/`.

## Features

- Save a URL with auto-fetched, editable title / description / site icon / preview image
- Duplicate-free saving (light URL normalization); re-saving opens the existing bookmark
- Full-page local copy (MHTML) — or the original PDF for PDF links — plus an Internet Archive link
- Flexible tags with reuse suggestions; Markdown notes (safely rendered)
- Readable list with rich search (`#tag`, `"exact phrases"`, `AND`/`OR`/`NOT`, parentheses; quoted operators are literal)
- Read-later queue, reversible archive, sorting, multi-select bulk actions (incl. "apply to all matching")
- Saved reusable filters, import/export in the standard browser bookmark HTML format (TAGS attribute)
- Personal display preferences (default sort, page size, text size)

## Stack

Node.js + Express + TypeScript · SQLite (better-sqlite3) · Playwright/Chromium
(MHTML capture) · React + Vite frontend.

## Develop / build / run

```bash
npm install
npm run build       # builds the SPA and compiles the server
npm start           # serves on http://0.0.0.0:4000

npm test            # unit + integration (Vitest)
npm run test:e2e    # end-to-end (Playwright)
npx tsx scripts/seed.ts   # optional: load demo bookmarks
```

## Layout

- `server/` — REST API, SQLite storage, metadata/capture/import-export services, search parser
- `web/` — React SPA (built into `dist/web`, served by the server)
- `specs/001-bookmark-manager/` — spec, plan, tasks, and design artifacts
