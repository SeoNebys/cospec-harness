# Verification report (cycle 1)

Verified against the Gherkin of approved scenarios SCN-001…SCN-018 plus internal
unit tests.

## Internal unit tests — `node --test` (18/18 pass)
- `tests/query.test.js` — search language: case-insensitive words, implicit AND,
  `#tag`, `"phrases"`, AND/OR/NOT (any case), grouping, quoted-operator-literal,
  note searched, malformed→fallback, highlight terms. (SCN-006, SCN-007)
- `tests/bookmarkfile.test.js` — Netscape parse/generate: titles, saved dates,
  tags, nested folders→tags, generic containers excluded, round-trip. (SCN-018)
- `tests/metadata.test.js` — og/title/host extraction, fallbacks; URL normalise/
  validate/pdf rules. (SCN-001, SCN-003, SCN-012)

## Acceptance pass (Playwright over the running server)
PASS for: SCN-001 capture, SCN-002 edit, SCN-003 no-duplicate (incl. trailing
slash + open-for-edit), SCN-004 tags + reuse suggestions, SCN-005 include/exclude
tri-state filter, SCN-006 search + highlight, SCN-007 `#tag` query, SCN-008
markdown notes, SCN-009 read status + To-read badge, SCN-010 archive/restore
(single + bulk), SCN-011 delete (confirmed, single + bulk), SCN-012 invalid input
blocked, SCN-013 responsive/wrapping (CSS), SCN-014 sort (incl. recently-updated)
+ page size + show-more + text size + saved default (persisted across reload),
SCN-015 bulk select-all-matching across pages + bulk tag/read/archive/delete,
SCN-017 saved views (save/reuse/persist), SCN-018 import/export (folders→tags,
generic excluded, notes/dates retained, dedupe on re-import, export carries
tags+dates).

## Live-network paths
- Verified against a **local fixture server** (stand-in for a reachable site):
  SCN-001 metadata extraction (og:title/description/image), SCN-016 single-file
  HTML snapshot (external CSS inlined, images as data URIs, banner added) and PDF
  stored & served as `application/pdf`.
- Verified **offline** (graceful failure, SCN-012/SCN-016): a page whose details
  cannot be fetched is still saved with a fallback title; a failed snapshot
  returns an error and never blocks or alters the bookmark.
- Internet Archive submission (SCN-016) depends on reaching web.archive.org at
  runtime; the request and its failure handling are implemented and the failure
  path is verified. Its success depends on outbound network availability in the
  runtime environment.

Result: all approved scenarios pass verification.
