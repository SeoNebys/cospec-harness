# Verification report — Cycle 1

Phase 3. Verified against the Gherkin of all 16 approved scenarios.

- Automated suite: `npm test` → **40 tests, 40 pass, 0 fail** (node:test).
- Module graph parses (`node --check` on every file) and serves over HTTP (200s).

## Coverage by scenario

| SCN | Given/When/Then verified by | Level |
|-----|------------------------------|-------|
| 001 Save + auto details | store.test, url.test (scheme, top-of-list, date) | automated |
| 002 Open a link | copy.test (`clickOpens` → original) | automated (logic) |
| 003 Quick rename | journey (title change) | automated (logic) |
| 004 No duplicate saves | url.test (www/slash/query), store.test (dup no copy) | automated |
| 005 Search fields + word-variation | search.test (summary, Rome≠Romania, multi-word) | automated |
| 006 Labels + reuse discipline | labels.test (case-insensitive reuse, multi, remove) | automated |
| 007 Browse by label | journey (label filter), app.js render | automated (logic) |
| 008 Read-later pile | journey (flag/clear/stays saved) | automated (logic) |
| 009 Saved copy + dead fallback + honesty | copy.test (all states incl. capture-failed) | automated |
| 010 PDF keeps the file | copy.test (pdf state, message) | automated |
| 011 Edit incl. searchable note | search.test (note), journey | automated |
| 012 Delete w/ one confirmation | store.test (remove), app.js confirm flow | automated (logic) |
| 013 Import folders→labels, dedupe, dates | imports.test (5 cases) + journey | automated |
| 014 Export take-anywhere | imports.test (round-trip) | automated |
| 015 Sort + dates | sort.test (newest/oldest/title, no mutate) | automated |
| 016 Bulk actions | store.test (removeMany), journey (label add/remove batch) | automated |

## Notes on level

- "automated" = the Given/When/Then are exercised directly by tests.
- "automated (logic)" = the rule/state behind the scenario is tested at the
  domain level; the DOM presentation (button clicks, modal, select mode) is thin
  wiring over that tested logic. These want a final human look in a browser —
  which is the Phase 4 acceptance walkthrough (no headless browser is available
  in this environment to automate the click layer).

## Result

All internal and Gherkin-mapped acceptance tests pass. No failures to send back
to Phase 2. Ready for Phase 4 acceptance (client walkthrough in a browser),
where the day-one moment of truth — importing a real pile — is confirmed live.
