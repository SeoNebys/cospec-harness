# Scenario → code map — Cycle 1

Basis for impact analysis in later cycles. For each approved scenario, where its
behaviour lives and which tests cover it.

| Scenario | Behaviour | Code | Tests |
|---|---|---|---|
| SCN-001 | Save link; optional name; blank→link; newest first | `core.js` `add`, `displayName`, `all`; `app.js` `onSave`, `render` | acceptance: "SCN-001 …" (x2); core: add/displayName |
| SCN-002 | Auto-fetch title on paste, editable, user name wins | `title.js` `extractTitle`; `server.js` `fetchTitle` + `/api/title`; `app.js` `onUrlInput`, `titleTouched` | acceptance: "SCN-002 …" (x2) |
| SCN-003 | Live search over name/address, case-insensitive | `core.js` `search`; `app.js` `render` (+`highlight`) | acceptance: "SCN-003 …" |
| SCN-004 | Multiple tags; browse by tag; counts | `core.js` `byTag`, `tagCounts`; `app.js` `renderTagbar`, `render` | acceptance: "SCN-004 …" (x2) |
| SCN-005 | Tag entry with reuse suggestions; new-tag create | `core.js` `normalizeTag(s)`, `suggestTags`; `app.js` `renderSuggest`, `addPendingTag`, `renderPills` | acceptance: "SCN-005 …"; core: suggestTags |
| SCN-006 | First-run welcome; search disabled when empty | `app.js` `render` (empty branch) | manual (UI) — verified Phase 3 |
| SCN-007 | Title-fetch fail / duplicate / non-link handling | `core.js` `looksLikeUrl`, `findByUrl`, `add` reasons; `server.js` failure→`{ok:false}`; `app.js` `onSave` banners, `onUrlInput` warn | acceptance: "SCN-007 …" (x3); core: looksLikeUrl/normalizeUrl |
| SCN-008 | Long title/URL clamp; scrollable tag strip | `styles.css` `.title` line-clamp, `a.link` ellipsis, `.tagbar` scroll | manual (visual) — verified Phase 3 |
| SCN-009 | Large collection: scroll + search/tags, no pagination | `app.js` `render` (renders all, no paging) | manual (UI) — verified Phase 3 |

## Files
- `src/core.js` — pure logic (all SCN behaviour rules)
- `src/title.js` — pure `<title>` extraction
- `src/app.js` — DOM wiring + localStorage
- `src/index.html`, `src/styles.css` — layout/visuals
- `server.js` — static serving + `/api/title`
- `test/core.test.js`, `test/acceptance.test.js` — unit + Gherkin-mapped tests
