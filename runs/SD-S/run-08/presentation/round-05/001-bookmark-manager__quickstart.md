# Quickstart Validation: Bookmark Manager

Use this guide to validate the implementation against the approved spec and [API contract](./contracts/openapi.yaml).

## Prerequisites

- Node.js 24 and npm
- Dependencies installed with `npm ci`
- Writable `data/`
- Playwright browsers at `/opt/playwright-browsers`

## Prepare and run

```bash
npm run db:migrate
npm run build
npm start
```

The prepared app must listen on `0.0.0.0:4000`. Review it at `http://maker:4000/`; automated checks use `http://127.0.0.1:4000/`.

## Automated validation

```bash
npm test
npm run test:integration
npm run test:security
npm run test:e2e
npm run test:performance
```

All suites must pass. The deterministic 10,000-bookmark run must show the first result page within 2 seconds for at least 95% of measured queries.

## End-to-end review

1. Start empty and confirm first-bookmark guidance.
2. Paste a reachable URL; confirm its document title and available icon appear in an editable preview.
3. Edit the title, add a note and tags, save, reload, and verify persistence.
4. Open the bookmark and confirm its record remains unchanged.
5. Save a page whose metadata fails; confirm warning, editable fallback, generic icon, and successful save.
6. Resubmit a saved URL; confirm the duplicate directs to the existing bookmark.
7. Edit a bookmark and tags; confirm metadata never replaces the edited title.
8. Test partial search across all fields, tag filtering, independent reset, and every sort.
9. Test punctuation, emoji, and non-Latin content.
10. Cancel deletion once and verify focus restoration; then confirm deletion and orphan-tag cleanup.
11. Repeat core flows keyboard-only at desktop and mobile viewports.

## Metadata security spot checks

Preview loopback, private, link-local, cloud-metadata, IPv4-mapped IPv6, mixed public/private DNS, and public-to-private redirects. All must return a generic unavailable result without protected-network access. Oversized, slow, non-HTML, looping, and malformed responses must terminate within configured limits while retaining the fallback-save path.

## Persistence check

Restart without removing `data/`. Bookmarks, tags, notes, edited titles, and cached icons must remain. Fresh migration and idempotent reopening must both succeed.

## Verified implementation results — 2026-09-18

- Prisma generation and forward migration succeeded; fresh creation and idempotent reopen are covered by integration tests.
- 10 unit tests, 7 repository/integration tests, 8 metadata security tests, and the deterministic 10,000-bookmark performance test passed.
- 14 Playwright checks passed across desktop Chromium and a mobile viewport, including the full preview/save/edit/delete journey, tags, filtering, search, sorting, keyboard focus, responsive overflow, and automated WCAG A/AA scanning.
- TypeScript checking, ESLint (no errors), dependency audit (zero known vulnerabilities), and the optimized production build passed.
- The production application was opened successfully at both `http://127.0.0.1:4000/` and `http://maker:4000/`; the ready marker appeared only after the usable collection state loaded.
- Visual inspection confirmed the empty collection, save form, search/filter controls, and responsive desktop layout render correctly.
- External metadata retrieval was validated with controlled fixtures and security tests. No claim is made that every third-party site will permit retrieval; blocked or failed sites use the specified editable fallback.
