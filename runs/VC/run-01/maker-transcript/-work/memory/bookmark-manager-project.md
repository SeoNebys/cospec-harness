---
name: bookmark-manager-project
description: Scope and decisions for the /work bookmark manager app
metadata: 
  node_type: memory
  type: project
  originSessionId: e2546f17-5890-43b4-b9df-5c95f6715dbc
  modified: 2026-09-16T16:33:28.658Z
---

Building a single-user (no login) bookmark manager in /work. Stack: Node + Express + SQLite (better-sqlite3), vanilla-JS frontend, Playwright 1.61.0 for page snapshots.

Required features (confirmed 2026-09-16):
- Add/edit/delete + favorites (star)
- Auto-fetch page title/favicon/description with manual fallback
- Read-later (unread) status with separate unread view
- Reversible archiving, separate from permanent deletion
- Markdown notes (render client-side, no CDN — sandbox has no internet)
- Duplicate URL → open existing bookmark for editing instead of creating another
- Advanced search across url/title/description/notes/tags: exact phrases, AND/OR/NOT, field prefixes
- Sorting + bulk actions incl. "apply to everything matching current filter"
- Saved searches/filters
- Import/export browser bookmark HTML (Netscape format)
- Local page snapshot (HTML + PDF) + optional save to Internet Archive (graceful if network blocked)
- Display prefs: default sort, page size, text size

Runtime: app on port 4000 (0.0.0.0), review via http://maker:4000. Write /work/.harness/app.json. Mark ready element with data-harness-ready="true". See CLAUDE.md runtime contract.

STATUS (2026-09-16): Fully built and verified. Backend: server.js + src/{db,model,search,metadata,snapshot,archive,netscape}.js. Frontend: public/{index.html,app.js,styles.css} (vanilla, no build). Verified via curl + Playwright: create/dup/edit/delete, boolean+phrase+field search, bulk incl. all-matching, import/export, prefs, saved searches, live metadata fetch (network IS available in sandbox), snapshot HTML+PDF via shared Chromium at /opt/playwright-browsers. 6 sample bookmarks seeded via scripts/seed.js. Leave port 4000 free between rounds so the broker owns the durable process. Snapshot needs PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers (set in src/snapshot.js).
