# Scenario-to-code map

| Scenario | Main implementation | Verification |
|---|---|---|
| SCN-001 | `public/app.js` save, card, open, and editor; `lib/metadata.js`; `lib/bookmarks.js` | `bookmarks.test.js`; saving browser test; empty-library browser test |
| SCN-002 | `canonicalizeUrl`, `BookmarkService.add`; duplicate focus/editor in `public/app.js` | canonical identity unit test; saving browser test |
| SCN-003 | label normalization/service update; card/editor label controls in `public/app.js` | edit unit test; label browser test |
| SCN-004 | `public/search.js`; live search rendering in `public/app.js` | search unit test; precise-search browser test |
| SCN-005 | label-state filters and card pills in `public/app.js` | label browser test |
| SCN-006 | query tokenizer/matcher and visible match/label controls | search unit tests; precise-search browser test |
| SCN-007 | Read Later service status and side destination UI | status unit test; Read Later browser test |
| SCN-008 | Archive service status, scoped views/search, restore UI | status unit test; archive browser test |
| SCN-009 | service delete and named confirmation UI | delete unit test; archive/delete browser test |
| SCN-010 | metadata failure fallback and retry/manual actions | failure unit test; saving browser test |
| SCN-011 | URL validation in service and save form | validation unit test; saving browser test |
| SCN-012 | tracking allowlist/fragment canonicalization | canonical identity unit test; duplicate browser test |
| SCN-013 | search empty state and unfinished-quote hint | tokenizer unit test; precise-search browser test |
| SCN-014 | label normalization, disabled blank action, duplicate feedback | label unit test; label browser test |
| SCN-015 | persisted status model without time-driven jobs | status persistence unit test; Read Later browser test |
| SCN-016 | dialog cancellation with mutation only on confirmation | archive/delete browser test |
| SCN-017 | compact-card heuristic, expansion state, full-value search | long-content browser test |

## Test layers

- `bookmarks.test.js`: data invariants and state transitions.
- `search.test.js`: search language and matching rules.
- `e2e.spec.js`: browser-level approved flows against the running application and JSON API.
