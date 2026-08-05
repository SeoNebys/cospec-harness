# Scenario → code mapping — cycle 1

Basis for impact analysis in later cycles. When a change touches a row's code,
re-verify the listed scenario.

| Scenario | Behaviour | Implementing code | Tests |
|----------|-----------|-------------------|-------|
| SCN-001 | Save a link; newest on top; title/host/icon; input clears | `core.addLink` (status `added`), `core.makeItem`, `app.js` submit handler + `render`, `index.html` save card | "SCN-001" block |
| SCN-002 | Live search across title/host/tags; clear restores; highlight | `core.filterItems`/`core.matches`, `app.js` `render`+`highlight`+search handlers | "SCN-002" block |
| SCN-003 | Optional multi-tags (comma), belong to many, click tag → search | `core.parseTags`, `core.makeItem`, `core.matches`, `app.js` tag-click wiring, `index.html` tags input | "SCN-003" block |
| SCN-004 | Long title/address trimmed to one line with ellipsis | `styles.css` `.title`/`.url` (`white-space:nowrap; text-overflow:ellipsis`) | "SCN-004" block (asserts CSS) |
| SCN-005 | "No links match" message on empty result set | `app.js` `render` (rows.length === 0 branch) | "SCN-005" block |
| SCN-006 | Reject non-link input, explain, don't add | `core.looksLikeLink`, `core.addLink` (status `invalid`), `app.js` invalid case | "SCN-006" block |
| SCN-007 | No duplicates; notify + jump/highlight existing | `core.dedupeKey`, `core.addLink` (status `duplicate`), `app.js` duplicate case + `.flash`/`scrollIntoView` | "SCN-007" block |
| (persistence) | Links survive browser restart on this device | `store.js` `load`/`save`, `app.js` `persist()` | "Persistence" block |

## Empty state (initial)
Covered by `app.js` `render` (items.length === 0 branch) + `index.html` `#empty`.
Confirmed in Phase 1; folded into SCN-001's screen.
