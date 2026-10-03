# Verification report — cycle 1

Date: 2026-09-27

Result: PASS

All 27 approved scenarios were checked against the finished application. The browser acceptance journeys use the same server, database schema, API, and browser code as the final app, with an isolated database and deterministic metadata source where an external page response must be controlled.

## Scenario results

| Scenario | Result | Verification evidence |
|---|---|---|
| SCN-001 | PASS | Browser first-save journey; metadata parser test; production smoke test with live `example.com` metadata |
| SCN-002 | PASS | Browser save journey edits collected wording before save |
| SCN-003 | PASS | Browser journey edits an existing card without navigation |
| SCN-004 | PASS | Browser duplicate journey edits the existing record and retains the collection count |
| SCN-005 | PASS | Browser live-description search; store tests for title, description, site, and address fields |
| SCN-006 | PASS | Uppercase browser query finds lowercase description wording |
| SCN-007 | PASS | Browser Recipes chip shows two matching cards and two results |
| SCN-008 | PASS | Picker behavior exercised through existing and new labels; database retains multiple labels |
| SCN-009 | PASS | Browser first-save journey adds Recipes and Weekend plans before saving |
| SCN-010 | PASS | Browser checkbox adds an unmarked card and Read later shows two results |
| SCN-011 | PASS | Browser uncheck removes the card immediately and updates the count |
| SCN-012 | PASS | Browser editor deletion requires permanent confirmation and updates the collection |
| SCN-013 | PASS | Six-item browser journey selects two, confirms permanent deletion, leaves four, and exits selection mode |
| SCN-014 | PASS | Browser batch adds existing Work label while preserving Recipes/Travel and selection |
| SCN-015 | PASS | Browser batch marks two items, preserves an already-marked item, and carries selection into Read later |
| SCN-016 | PASS | Browser archive/edit/restore journey; store test confirms labels and reading state survive |
| SCN-017 | PASS | Browser controlled metadata failure saves both unchanged fallback and personalized fallback; metadata unit test |
| SCN-018 | PASS | Browser incomplete-address error; API and URL validation tests |
| SCN-019 | PASS | Browser zero-result message, zero count, unchanged query, and clear recovery |
| SCN-020 | PASS | Browser lowercase label entry reuses Recipes, explains reuse, and saves one canonical label |
| SCN-021 | PASS | Browser checks two/three-line clamps, ellipsis, +5 label count, equal card height, complete editor values, and mobile column |
| SCN-022 | PASS | URL normalization tests and browser tracking/fragment duplicate journey; meaningful query difference test |
| SCN-023 | PASS | Browser initial empty screen hides controls; first save restores them |
| SCN-024 | PASS | Browser empty Read later message retains controls and View all returns to the collection |
| SCN-025 | PASS | Browser archived duplicate opens with archived notice and does not restore; API identity test |
| SCN-026 | PASS | Routed browser save failure retains title, description, label, and draft; retry creates one complete record |
| SCN-027 | PASS | Store ownership review and tests confirm no automatic refresh path; card link retains original address |

## Final automated runs

- 15 unit/integration tests passed.
- 5 multi-step browser acceptance journeys passed.
- A 240-bookmark store exercise passed combined search, label, and Read later queries.
- The final server passed a production-port smoke journey with live external metadata, persistent save, confirmed deletion, and restored clean empty state.
- Runtime dependency audit reported zero known production vulnerabilities.

## Deferred by agreement

- Preserving a readable copy of the original page.
- User-controlled collection sorting.

Both are recorded for a later cycle and were not included in cycle 1 verification.

