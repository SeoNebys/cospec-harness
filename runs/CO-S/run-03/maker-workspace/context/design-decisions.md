# Design decisions — Cycle 1

Lightweight record of what was decided and why, for later impact analysis.

## D1 — Client-only web app, localStorage persistence, no accounts
**Decision:** A static website (HTML/CSS/JS) that stores bookmarks in the browser's
localStorage. No server, no login.
**Why:** The client only requires that bookmarks persist ("still there when I come
back") from one computer's browser; he explicitly does not care about login
mechanics (SESSION-001). This is the smallest thing that satisfies persistence and
matches "nothing fancy".
**Dropped alternatives:**
- Accounts + backend DB — deferred; only needed if multi-device access is later
  requested (non-functional backlog #1, #4).
**Revisit if:** the client wants the same bookmarks on another device/browser.

## D2 — Titles derived from the URL, not fetched from the page
**Decision:** The automatic title is built from the URL (last path segment,
prettified, plus the host), e.g. `Some Great Recipe — nytimes.com`.
**Why:** A client-only app cannot fetch a remote page's <title> (browsers block
cross-origin requests, and there is no server). Deriving from the URL is always
available, deterministic, and testable, and satisfies SCN-001's approved behaviour
("a readable title is produced automatically; the user does not type it").
**Dropped alternatives:**
- Fetching the real page title via a proxy/backend — more infrastructure than the
  agreed scope; possible future enhancement.
**Revisit if:** the client wants the real page title and accepts a backend/proxy.

## D3 — Groups are labels derived from links (no standalone group entities)
**Decision:** The set of groups is computed from the labels currently on links
(`usedGroups`). There is no separate stored list of groups.
**Why:** Client said groups "are really just labels I stick on links"; empty groups
should vanish (SCN-007). Deriving avoids orphaned empty groups by construction.
**Consequence:** No "create an empty group" feature. Matches SCN-007.

## D4 — Group names case-insensitive; first-seen spelling wins
**Decision:** `canonicalGroup` matches names case-insensitively against groups in
use and reuses the existing spelling; new names keep their typed spelling (SCN-012).
**Why:** Avoids near-duplicate groups ("work" vs "Work"), a mess the client is
trying to escape.

## D5 — Duplicate detection by normalized URL key
**Decision:** `normalizeUrl` builds a key that lowercases, drops scheme, a leading
`www.`, and a trailing slash. Saving a link whose key already exists is blocked and
the existing bookmark is highlighted (SCN-010).
**Why:** Central to the goal (no duplicate clutter). Normalization chosen to catch
the common "same page, cosmetically different URL" cases without over-reaching.
**Revisit if:** false-positive/negative duplicates surface in real use (e.g.
query-parameter-significant URLs). Query string is currently part of the key.

## D6 — Architecture: pure core + thin DOM + storage
- `core.js` — pure logic, no DOM; shared by app and tests (UMD-style export).
- `storage.js` — localStorage load/save (browser only).
- `app.js` — DOM rendering and event wiring; persists after every change.
- `index.html` / `styles.css` — structure and presentation.
**Why:** Keeps the approved behaviour unit-testable in Node without a browser, and
isolates the parts most likely to change (UI, persistence) from the rules.

## Structure notes for a cold reader
- Newest-first ordering is maintained by `unshift` on save; tests build arrays the
  same way.
- Long-content resilience (SCN-011) is purely CSS (line-clamp + ellipsis) in
  `styles.css`; verified visually in Phase 3.
