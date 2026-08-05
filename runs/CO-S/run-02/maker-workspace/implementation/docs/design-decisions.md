# Design decisions — Cycle 1

Lightweight record of what was decided, why, and what was dropped. Written so
the structure is recoverable after a context reset and so impact analysis is
possible in later cycles.

## Overall shape

- **Browser web app + tiny Node server.** The goal is a website the user pulls
  up in their browser (goals.md). The server exists only to (a) serve the static
  app and (b) look up page titles, which the browser cannot do for arbitrary
  cross-origin pages. Chosen over a pure static app because SCN-002 (auto-title)
  needs server-side fetching.
- **Zero runtime dependencies.** Uses only Node built-ins (`http`, `fs`,
  global `fetch`, `node:test`). Rationale: trivial to run/test in this
  environment; nothing to install; small attack surface. Dropped: Express,
  a bundler, a front-end framework — unnecessary for this scope.
- **Pure core module (`src/core.js`), no DOM/storage/network.** All behavioural
  rules (validation, dedup, search, tag logic, suggestions) live here so they
  are unit-testable and map 1:1 to the Gherkin. The UI (`app.js`) and
  persistence (localStorage) are thin shells around it. This is the main seam
  for later-cycle changes.

## Key decisions

- **Persistence = browser localStorage** (`mybookmarks.v1`). Single-user, local,
  no accounts (goals.md: "mainly just for me"). Dropped: a database / server-side
  storage — out of scope for cycle 1. NOTE for later cycles: data currently lives
  per-browser; cross-device sync is not provided.
- **Title lookup on paste, editable before save (SCN-002).** UI auto-fills the
  name field ~500ms after the link changes, but never overwrites a name the user
  has already typed (`titleTouched` guard). Core stores whatever name is present
  at save time.
- **Title fetch failure is non-blocking (SCN-007).** Server maps any failure
  (bad host, timeout at 6s, non-200, no `<title>`) to `{ ok:false }`; UI shows a
  warning and lets the user name it themselves and save anyway.
- **Duplicate detection by normalized URL (SCN-007).** `normalizeUrl` drops
  scheme, leading `www.`, and trailing slash, then lowercases. Two links equal
  under this are "the same". Dropped: exact-string matching (would let trivial
  variants through) and full canonicalization incl. query params (too aggressive;
  `?id=1` vs `?id=2` are different pages).
- **Tag normalization for consistency (SCN-005).** `normalizeTag` trims,
  lowercases, and collapses internal whitespace, so `Recipes`/`recipes` collapse.
  Suggestions are drawn from existing normalized tags; "+ create" appears only
  when the typed tag is genuinely new. This is the anti-fragmentation mechanism.
- **Search matches name OR address only (SCN-003).** Deliberately does not search
  tag text — tags are reached via the tag browser (SCN-004). Keeps the two
  finding paths distinct and faithful to the approved Gherkin.
- **Empty state / no-match / boundary handling.** Welcome block replaces an empty
  list and search is disabled while empty (SCN-006). No pagination; full list
  scrolls, volume handled by search/tags (SCN-009). Long titles clamp to 2 lines,
  long URLs ellipsize, tag bar is a fixed-height scroll strip (SCN-008) — all CSS.

## Explicitly deferred (see context/non-functional-backlog.md)

- Dead-link detection (client deferred).
- Editing/deleting existing bookmarks — no approved scenario in cycle 1; not built.
- Cross-device sync / accounts.
