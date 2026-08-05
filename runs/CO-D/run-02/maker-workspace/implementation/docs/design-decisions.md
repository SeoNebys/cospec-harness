# Design decisions

Why the implementation is shaped the way it is. Written so the structure can be
picked up again after context is lost, and so change-impact analysis is possible
in later cycles.

## Overall shape

- **Static, install-free web page.** The client wanted "just a page I go to," no
  install, single-user, no cross-device sync (goals.md). So the app is a plain
  `index.html` + CSS + classic `<script>` files that runs by opening the file —
  no build step, no server required.
- **Layered so logic is testable without a browser:**
  - `src/core.js` — pure domain logic (no DOM, no storage). The single source of
    truth for searching, ordering, filtering, link normalisation and metadata.
  - `src/store.js` — the collection: state, persistence, and mutation operations,
    built on core. Persistence is **injected** (real `localStorage` in the
    browser; an in-memory object in tests) so operations are testable.
  - `src/app.js` — the browser UI. Renders the store and wires interactions.
  - UMD wrapper on core/store so the same files load as browser globals *and*
    as Node `require()` for the test suite (no duplicated logic).

## Persistence

- **`localStorage`, keyed `bm_items_v1` (items) and `bm_sort` (order preference).**
  Fits single-user / one-browser / no-sync.
- Alternatives dropped: a backend/database (contradicts "no install, just a
  page"); IndexedDB (heavier than needed for this data size).

### Durable persistence — the acceptance-blocker defect and its fix

- **Symptom (found at acceptance):** opened as a double-clicked `file://` page,
  saved bookmarks did not survive a reload. This is the app's single most
  important promise, so it blocked acceptance.
- **Cause:** browsers give `file://` documents an opaque/shared origin and some
  restrict or don't durably persist `localStorage` there. The storage *code* is
  correct (proven by tests); the problem is the `file://` runtime.
- **Fix, two parts:**
  1. **A tiny local server + one-double-click launcher** (`server.js` +
     `start.command`/`.sh`/`.bat`). Running from `http://localhost` gives a
     stable origin where `localStorage` persists reliably. This is the
     recommended way to open the app; it keeps "no install" (only Node, the
     build/runtime already assumed) and "open it the same way every time".
  2. **A durability self-check** (`durableStorage()` in app.js): the app writes
     and reads back a probe key. If storage is not durable, it shows a clear
     warning banner instead of pretending to save — so data is **never lost
     silently** (the client's worst-case fear).
- **Tests:** `ui.test.js` simulates close-and-reopen with persisted storage
  ("saved bookmarks survive… reopening"), and asserts the warning appears when
  storage is blocked. `server.js` verified to serve the app and reject path
  traversal.
- **Residual note:** the launcher requires Node.js on the client machine. If a
  future cycle needs zero-Node persistence, options are a packaged desktop app
  (an install — previously out of scope) or export/import to a file.

## Search (SCN-001)

- Query is tokenised on whitespace; **every** token must match (AND), each from
  the **start of a word** (`\b` + token) so short words don't match mid-word
  ("read" ≠ "bread"). Case-insensitive.
- Searchable text = title + page summary + the client's own note + readable site
  name + host. The note being searchable is a make-or-break requirement.

## Links & duplicates (SCN-004, SCN-005, SCN-008)

- `normalizeUrl` ignores protocol, `www.`, trailing slashes and case (whole
  string, path included). **Decision:** lowercasing the path too is deliberate —
  in a personal tool it prevents accidental duplicates and matches "links that
  differ only superficially are the same." Risk: two genuinely different
  case-sensitive paths on the same host would be treated as one; judged
  acceptable for this use.
- A valid web address is **required** to save (a bookmark is a link); missing
  protocol is tolerated by prepending `https://`.

## Metadata auto-fill (SCN-004) — known limitation

- `resolveMetadata` recognises a small seeded set of sites and otherwise derives
  the readable site name from the host, leaving the title to the client (the
  graceful path of SCN-008).
- **A static page cannot fetch arbitrary cross-origin pages (browser CORS), so
  true "read any page" auto-fill needs a small fetch service.** That is
  intentionally deferred. The behaviour approved in Phase 1 was *simulated* in
  the prototype (recorded in SCN-004 assumptions). To be raised at acceptance:
  either add a tiny fetch helper later, or accept that auto-fill is best-effort
  and the client names unread-from-unknown-sites items themselves. `resolveMetadata`
  is isolated so a real resolver can slot in without touching the UI.

## Reading pile as state, not label (SCN-010)

- `unread` is a boolean on each bookmark, independent of labels. Modelled as a
  filtered view (`reading:true`) that composes with search/order and excludes
  set-aside items. Chosen over a label because a label relied on the client to
  remove it by hand, so the pile would rot — the client's explicit concern.

## Set aside vs delete, with undo (SCN-006)

- `aside` boolean hides an item from the main list, search and roundups, but
  keeps it (reversible). Delete removes it; the operation returns the item and
  its index so an Undo can re-insert it exactly. Undo is a UI affordance driven
  by a short-lived toast.

## Ordering (SCN-009)

- Items carry an `added` sequence number (max+1 on save) — used instead of wall
  clock so ordering is deterministic and testable. Sorts: newest (default),
  oldest, A–Z. Preference persisted in `localStorage` and applied to whatever is
  on screen (full list, search, or roundup).

## List readability (SCN-007 lesson)

- Empty cards must not carry a big empty note box; a note-less card shows only a
  quiet "＋ add a note" link. Three distinct empty states (day-one welcome /
  everything-set-aside / no-results) so an empty screen never reads as data loss.
