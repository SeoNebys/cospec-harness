# Session log

## SESSION-001 (2026-09-23) — Cycle 1, Phase 1

Goal confirmed: reliable capture + retrieval of personal bookmarks (web app).

Approved so far (SCN-001..012): save with auto-details; tags+note while saving
with suggestions; edit tags/note later; read-later; archive/restore; tag filter
bar; search query language; invalid-link rejection; duplicate handling; unreadable
-page fallback; edit title/description; long-content clamp + tag wrap.

### Exploration agenda (client-requested, this cycle) — ALL DONE

Item management:
- [x] Delete a bookmark (SCN-013)
- [x] Change a saved URL (SCN-014)
- [x] Sort the list (SCN-015)

Bulk actions:
- [x] Select several / all-in-view; tag add+remove, read/unread, archive, delete (SCN-016, SCN-017)

Larger features:
- [x] Preserve a copy of a page — local full-page + Internet Archive (SCN-019, SCN-020)
- [x] Saved reusable searches (SCN-018)
- [x] Import / export browser bookmarks (SCN-021, SCN-022)
- [x] Basic display preferences + paging/text size (SCN-023, SCN-024)

### Edge-case exploration — new features

Confirmed with prototype (visual state change): import of a non-bookmarks/empty
file ("No bookmarks found"); import where all links already exist ("All N already
saved", nothing added). See prototypes/import-export.html.

Confirmed with text (reason: behaviour-existence only, or depends on external
service/time and cannot be reproduced in a static prototype):
- Delete undo window then permanent (SCN-013).
- Bulk delete undo restores the whole batch (SCN-017).
- Snapshot capture failure and Internet Archive unavailability — surface a clear
  message, leave the bookmark intact without that copy, allow retry.
- Export with zero bookmarks produces an (empty) valid file.
- Saved search whose tag was later removed shows a clean "no matches" state.

## Phase 2–3 — Development & Verification (SESSION-001)

Production app built in `implementation/` fresh from GWT (no prototype reuse).
Zero-dependency Node http server + JSON store; client-side search/filter/sort/
paging; shared query/markdown/import-export modules; server-side metadata,
full-page snapshot (HTML self-contained / PDF preserved), Internet Archive.

Verification result: PASS.
- Unit/integration: 34/34 pass (`node --test test/unit/*.test.js`) — query,
  markdown, import/export, and full service against a local fixture site.
- Gherkin acceptance: 35/35 pass (`python test/acceptance/acceptance.py`) driving
  the real UI across SCN-001…025.
- Live smoke: real save of https://example.com returned "Example Domain"; no
  console/page errors.
Two defects found and fixed during verification: duplicate key ignored query
strings; search highlighter corrupted markup on single-letter terms.
Internal info system: docs/design-decisions.md, docs/scenario-code-map.md.

