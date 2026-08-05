# Design-decision record — Cycle 1

Lightweight record of what was decided and why, to enable impact analysis in
later cycles.

## Architecture

- **Local web app: Node built-in HTTP server + vanilla browser UI.**
  Runs on the client's computer (goal: "web app on my computer"). A server is
  required because the browser cannot fetch arbitrary pages' titles
  (cross-origin) — title fetching happens server-side (SCN-001).
- **Zero external dependencies.** Uses only Node stdlib (`http`, `fs`, `crypto`,
  global `fetch`). Chosen to avoid an install step and keep the app inspectable.
  Alternative dropped: Express + a DB — unnecessary for a single-user local app.
- **Storage: a JSON file** (`data/bookmarks.json`), path injectable.
  Satisfies persistence (NF-2). Alternative dropped: SQLite (adds a dependency;
  not needed at this scale — NF-1 revisit if collections grow very large).
- **Shared logic module (`src/shared.js`)** loaded by BOTH server (require) and
  browser (`<script>` → `window.BM`), served straight from `src/` so there is a
  single source of truth for validation/search/dedup/title-parsing. This is why
  search (SCN-002) and tag filtering (SCN-003) are tested once in
  `test/shared.test.js` and behave identically in the UI.

## Key behavioural decisions

- **Title fetch never blocks a save** (SCN-001/006/007). On any failure (offline,
  timeout, no title, non-HTML) the link is saved with `needsTitle: true` and a
  site-name fallback title; a `refresh-title` endpoint re-attempts later.
- **Duplicate detection by canonical URL** (SCN-006): scheme, leading `www.`, and
  trailing slash are ignored. Duplicates are rejected (409) rather than silently
  merged, so the UI can point the client to the existing one.
- **Delete uses deferred-commit + undo** (SCN-008). The UI hides the item
  immediately and only sends `DELETE` after the ~5s undo window; Undo cancels the
  pending delete, restoring the item in place with no server round-trip. Chosen
  over confirm-before-delete (client rejected per-item confirmation) and over
  delete-then-recreate (would lose id/position and re-trigger title fetch/dedup).
  Trade-off: if the tab closes within the undo window, the delete may not persist
  — acceptable and fail-safe (nothing lost).
- **Tagging is a post-save in-the-moment prompt** (SCN-004). Instant save is
  preserved; a tag prompt with autocomplete (from existing tags) appears on the
  just-saved item and is dismissible. Always-available card tagging (prototype B)
  and tag-before-save (prototype A) were rejected by the client.

## Out of scope this cycle (client decision)
- Dead-link detection (may revisit later).
- Multi-select / bulk delete (not requested).
