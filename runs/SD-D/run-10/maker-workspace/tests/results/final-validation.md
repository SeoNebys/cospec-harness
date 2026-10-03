# Final v1 validation

Recorded 2026-09-18 in the shared Node 24/Linux/Chromium environment.

## Clean build and static checks

- `npm ci`: completed from `package-lock.json` (489 packages, 0 reported vulnerabilities).
- `npm run format:check`: passed.
- `npm run typecheck`: passed for client, server, shared, and test projects.
- `npm run lint`: passed.
- `npm run build`: passed; Vite produced the production client and TypeScript produced the production server.

## Automated behavior

- Unit: 10 files, 40 tests passed.
- Integration/security: 7 files, 9 tests passed.
- HTTP contract: 8 files, 15 tests passed.
- Performance: both deterministic suites passed: representative search over 10,000 bookmarks remained below the one-second target, and the 1,000-item bulk operation accounted for all 1,000 items.
- Playwright: 22/22 tests passed, running all 11 v1 journeys in both desktop Chromium and the Pixel 7 phone viewport.

The browser run covers rich capture and fallback, Read Later, tag-first organization, archive/restore/permanent delete, precise and invalid search, live saved searches, bulk all-match confirmation, stale-edit handling, privacy/persistence, and primary-view visual checks.

## Runtime delivery

- Migrations and the idempotent review-account seed completed before startup.
- A legacy incomplete FTS projection in the long-lived review database was detected and rebuilt from the source bookmark rows; the subsequent startup required no rebuild and passed maintenance checks.
- `npm start` is running as a foreground service on `0.0.0.0:4000`.
- `/health/ready` returned `200` with `{ "status": "ready" }`.
- Both `http://127.0.0.1:4000/` and `http://maker:4000/` returned `200`.
- A real Chromium load found exactly one `data-harness-ready="true"` marker after initial session resolution, signed in through the seeded review account, and loaded the preserved two-bookmark review library.

## Review-data hygiene

Fourteen clearly named automated-browser fixtures that had been written to the long-lived review database during an earlier reused-server run were removed. The two manually reviewed bookmarks, `Example Domain` and `Edited AFTER save`, were retained. A recoverable pre-cleanup copy remains at `data/bookmarks.pre-fixture-cleanup.sqlite`.
