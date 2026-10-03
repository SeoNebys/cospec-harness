# Quickstart and Validation Guide

## Prerequisites

- Node.js 24.15–24.x and npm
- Writable data directory
- Playwright 1.61 Chromium at `/opt/playwright-browsers`

## Setup and Run

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

The built server listens on `0.0.0.0:4000`; reviewers use `http://maker:4000/`. The UI exposes `data-harness-ready="true"` only once initial data is ready.

## Automated Validation

```bash
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
```

## Acceptance Run

1. Save a controlled page; verify metadata/icon prefill and manual override. Repeat an equivalent URL and verify the canonical record opens.
2. Verify unread, read, archive, archive browsing, and lossless restore.
3. Render every supported note structure and hostile markup; verify safe output and searchable visible text.
4. Exercise [search-grammar.md](contracts/search-grammar.md), malformed syntax, and a saved search after data changes.
5. Select explicit and all-matching records across pages. Change matches between preview and execute, verify `stale_selection`, reconfirm, and run every bulk action.
6. Import nested, duplicate, invalid-scheme, hostile, and partially corrupt fixtures. Verify tags/counts. Export active plus archived records and import into a representative browser.
7. Change all preferences, restart, and verify persistence plus saved-search sort precedence.
8. Seed 10,000 bookmarks; measure search/filter/sort/page p95 below 1 second and bulk completion below 10 seconds.
9. Test private/reserved IPv4/IPv6, DNS rebinding simulation, redirects, oversized/decompressed bodies, timeouts, MIME mismatches, and malicious icons.

Expected: all checks pass, no duplicate/unselected record changes, persistence survives restart, and unsafe fetch/content fixtures are blocked without losing entered data.

## Implementation Validation — 2026-09-17

- Lint: passed
- TypeScript typecheck: passed
- Production build: passed
- Unit and integration tests: 14 passed
- Playwright primary journey: passed
- Dependency audit: 0 known vulnerabilities
- Review server: prepared on `0.0.0.0:4000`
- Review screenshot: `prototypes/bookmark-manager-review.png`
