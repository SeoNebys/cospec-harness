# Final Validation Evidence

**Date**: 2026-09-17  
**Result**: Pass

## Clean preparation and static quality

The approved quickstart sequence was run from `/work` against Node.js 24:

| Command | Result |
| --- | --- |
| `npm ci` | Pass; 299 packages installed, 0 reported vulnerabilities |
| `npm run format:check` | Pass; 128 files checked |
| `npm run lint` | Pass; 136 files checked with no diagnostics |
| `npm run typecheck` | Pass; strict client and server TypeScript checks |
| `npm run build` | Pass; Vite client and server TypeScript production output |

The unit/component command emitted non-failing Happy DOM connection noise for its synthetic
`127.0.0.1:3000` document origin. It did not represent an application request or a failed test.

## Automated suites

| Layer | Evidence |
| --- | --- |
| Unit and component | 11 files, 146 tests passed |
| Integration and contract | 17 files, 110 tests passed |
| Performance | 2 files, 2 seeded benchmark suites passed |
| End to end | 10 Chromium journeys passed together in 49.7 seconds |
| Accessibility | Axe reported no violations in the tested empty, populated, filtered, capture, detail, editor, Read Later, archived, saved-view, and bulk states; keyboard focus/restore assertions passed |
| Responsive | 320 × 720 and 1440 × 900 capture, collection, filters, notes, saved views, and bulk states had no horizontal page overflow |

Measured performance on the supplied container:

- 10,000-bookmark search overall p95: 179.75 ms, below the 1,000 ms target.
- Slowest tested search path: two-character fallback at 185.38 ms p95.
- Slowest 1,000-bookmark bulk action: permanent deletion at 23.58 ms p95, below the 10,000 ms target.

Detailed query plans, distributions, and environment notes are in
[`performance-results.md`](./performance-results.md).

## Approved scenario coverage

- **Paste and save**: address-only fallback, deterministic metadata preview, immediate saving,
  persistence, safe external opening, manual override retention, normalized duplicates, and
  archived duplicates are covered by capture browser, integration, security, and race suites.
- **Search and filtering**: partial terms, phrases, exact tags, multi-tag AND filters, explicit
  AND/OR, errors, status filters, scopes, sorting, pagination, and URL restoration are covered by
  parser/evaluator/contract/component/browser suites.
- **Read Later and archive**: favorite independence, marking read, archive hiding, unread retention,
  and restoration back into Read Later are covered in dedicated and organization journeys.
- **Organization and notes**: full edits, normalized tags, candidates, safe Markdown, favorite,
  archive/restore, dates, reload persistence, and searchable note text are covered across unit,
  integration, component, and browser tests.
- **Bulk actions**: a 52-result set spanning 50 visible and 2 off-screen results is snapshotted;
  later matching drift is excluded. Every supported action, exact counts, clearing on view change,
  cancel/confirm deletion, and out-of-set isolation pass in the browser and transactional suites.
- **Individual edit/delete**: full persistence, invalid and duplicate-address rollback, duplicate
  navigation, cancel, permanent confirmation, cascade cleanup, and absence from every scope pass.
- **Saved views**: exact live criteria, current-data reevaluation, update/rename, missing-tag
  preservation, cancel/confirm deletion, and bookmark retention pass.

## Security and runtime checks

- The SSRF/resource suite covers public/private IP classification, all-answer DNS validation,
  pinned addresses, per-hop redirects, custom-port denial, deadlines, redirect/decoded-byte/type
  limits, active/spoofed/oversized icons, safe re-encoding, and no credential headers.
- Race suites cover late manual edits, out-of-order address revisions, pending restart, and
  deletion-safe late work.
- Application tests verify CSP, frame, MIME and referrer headers; same-origin JSON-only mutations;
  and friendly responses without internal details.
- `npm start` applied migrations and listened on `0.0.0.0:4000`. Live probes returned `200
  {"status":"ready"}` for `/api/health` and the built HTML for `/`. SIGINT produced the graceful
  shutdown path.
- The full browser suite uses deterministic metadata fixtures. No claim is made that a particular
  public website will expose metadata; unavailable/refusing sites intentionally retain fallbacks.

The prepared application is registered at `/work/.harness/app.json` and is reviewed at
`http://maker:4000/`.
