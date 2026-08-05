# Design-decision record — cycle 1

## Architecture

**Static client-only web app, no backend.**
- Why: scope is single user, single device, "just open a page", links must
  persist across browser restarts. No sharing, no cross-device sync requested.
- Storage: browser `localStorage` (key `bookmarks.v1`), a JSON array of items.
- Dropped alternatives:
  - Server + database — rejected: no multi-device/multi-user need; adds hosting,
    accounts, deployment for zero benefit in this scope.
  - IndexedDB — rejected for now: localStorage is ample for a personal list of
    hundreds of links and far simpler. Revisit only if item count/blob storage
    grows (see NF-3).

## Code layout

| File | Responsibility |
|------|----------------|
| `core.js` | Pure logic (no DOM/storage): validation, normalisation, title/host derivation, dedupe key, tag parsing, search filter, `addLink` outcome. Dual-exported for Node tests and the browser (`window.BM`). |
| `store.js` | `localStorage` load/save with defensive parsing (`window.BMStore`). |
| `app.js` | DOM wiring: renders the list, handles save/search/tag-click, highlights matches, persists on change. |
| `index.html` | Markup + script includes. |
| `styles.css` | Presentation, incl. SCN-004 single-line truncation. |
| `tests/core.test.js` | Acceptance + unit tests (plain Node). |

## Key decisions

- **Pure core, imperative shell.** All behaviour with a testable rule lives in
  `core.js`; `app.js` only translates between the DOM and `core`. This is what
  lets the acceptance tests run headless under Node.
- **`addLink` returns a discriminated outcome** (`empty` / `invalid` /
  `duplicate` / `added`) plus a new immutable items array. The UI maps each
  outcome to a message/behaviour; tests assert on the outcome directly.
- **One field for finding.** Search matches title + host + tags together;
  clicking a tag just fills the search box. No separate filter subsystem — a
  deliberate choice the client valued ("less for me to think about").
- **Duplicate key** ignores scheme, leading `www.`, and trailing slash;
  query/fragment are significant. Chosen as a pragmatic "same page" definition.
- **Link heuristic**, not strict validation: must contain a dot + TLD-like
  ending; scheme optional. Enough to keep out accidental junk (SCN-006) without
  nagging on valid inputs.

## Known non-goals / future candidates
- Editing an existing link's tags (client called it "a nice touch" on the
  jump-to-existing flow; deferred — see SCN-007 assumptions).
- Deleting links (not raised in cycle 1).
- Cross-device sync (explicitly out of scope).
