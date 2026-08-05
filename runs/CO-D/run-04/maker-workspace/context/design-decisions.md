# Design-decision record (Cycle 1)

Accumulated during Phase 2. Captures what was decided, why, and dropped
alternatives — enough to do impact analysis in later cycles.

## DD-001 — Local-first, private by default
The app is single-user, private, works offline for what it can, and the client
must never feel locked in (SCN-015/016/018). Decision: data lives on the
client's own machine, not a company server. No accounts (matches goal).
- Library data (links, notes, labels, states, saved searches): a local database
  in the browser (IndexedDB — handles large data and binary blobs, unlike
  localStorage).
- Saved copies: readable HTML + PDF files + optional visual snapshot stored as
  blobs alongside.

## DD-002 — How the app reaches the web (THE open fork)
Browser security (CORS) forbids a plain web page from fetching other sites'
content, so a pure static web app CANNOT, by itself: fetch a link's title/
description, or capture a saved copy of an arbitrary page. This is the one
architectural fork; options:
  (A) Browser extension + IndexedDB. The extension can read the page the client
      is actually looking at → best, most faithful capture of title/description/
      readable copy/PDF; a "save this page" action right where they read; no
      server to run; lives in the browser ("where I live"). Library UI is a
      full-page tab. Cost: install per browser.
  (B) Local companion app (small program on the client's computer) + browser UI.
      Robust fetching/snapshotting server-side; normal web-app feel. Cost: the
      client has to run a background process.
  (C) Hosted service/proxy. Rejected: breaks "private, on my machine, no
      lock-in" — sends browsing to a server.
- RECOMMENDATION: (A) extension. Best fit for capture + saved copies + privacy +
  "in my browser", nothing to run.
- DECIDED: (A) browser add-on — client confirmed (SESSION-001). Deciding reason
  in client's words: "nothing running in the background" that could break
  silently; lives in the browser where they already are; one-time install is a
  fair price. Backup/restore (SCN-015 .json) is the affirmed safety net for a
  lost/stolen machine — local-first is fine because the backup exists.

## Build order (slices; each maps to approved scenarios)
1. Core spine — save/recognise/list/open/dedupe (SCN-001..004), on the local DB.
2. Edit + notes + labels (SCN-005,006,007,019).
3. Findability — search, topics (stack + exclude), sort (SCN-008,009,014,021).
4. Read-later + tidy — pile, bulk, delete+undo, set-aside (SCN-010,011,012,013).
5. Saved searches (SCN-020).
6. Trust — saved copies, PDFs, public archive, import/export (SCN-015,016,017).
7. Edges + comfort — first-run, junk paste, overflow, text-size + light/dark
   (SCN-018,022,023 + comfort set).

## Records to maintain (per development.md)
- This file (design decisions).
- context/scenario-code-map.md (SCN-NNN -> files/functions).
- Tests: Gherkin-based acceptance tests + unit/integration, built alongside.
