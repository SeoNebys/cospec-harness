# Quickstart and Validation Guide

This guide defines how the completed application will be prepared and validated. Commands become runnable during implementation.

## Prerequisites

- Node.js 24 and npm
- Chromium supplied at `/opt/playwright-browsers`
- Writable `data/` directory

## Prepare and run

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

The production server must listen on `0.0.0.0:4000`. Review it at `http://maker:4000/`; automated browser checks use `http://127.0.0.1:4000/`. The rendered, fully initialized view must expose `data-harness-ready="true"` only after the initial bookmark query has resolved, including a valid empty state.

## Automated verification

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Tests use temporary SQLite databases and deterministic local metadata fixtures; they must not retrieve arbitrary public pages. `@playwright/test` is pinned to `1.61.0` to match the installed browser revision.

## Acceptance walkthrough

1. Start from an empty collection and confirm the first-bookmark guidance is visible.
2. Paste a local fixture page URL that provides title and description. Confirm progress is announced and both editable fields populate.
3. Edit only the title before a delayed metadata response completes. Confirm the title remains yours while an untouched description may populate.
4. Save with tags, reload the page, and confirm all values persist and the bookmark opens the saved URL.
5. Paste a fixture URL that times out or has no metadata. Confirm the request finishes within ten seconds, the URL becomes the editable title, the description remains editable/empty, and saving is allowed.
6. Attempt a duplicate normalized URL and confirm the existing bookmark is identified rather than duplicated.
7. Create enough varied bookmarks to search title, URL, description, and tags. Confirm case-insensitive partial search, single-tag filtering, clear-filter behavior, and no-results guidance.
8. Edit all bookmark fields and confirm the updated record persists without unrelated changes.
9. Request deletion, cancel, and verify the record remains. Repeat and confirm deletion, then verify it disappears.
10. Complete the core flow by keyboard only. Check logical focus, visible focus, labelled controls, status/error announcements, Escape/cancel behavior, and focus restoration after the delete dialog.

## Security validation

Use the local fixture/DNS abstraction to verify rejection of localhost, private/link-local/reserved IPv4 and IPv6, mapped addresses, mixed public/private DNS answers, rebinding, nonstandard ports, and public-to-private redirects. Verify redirect, time, and decoded-body limits and confirm API errors expose no resolved IPs, response bodies, or stack traces.

## Contract and model references

- JSON endpoints and error shapes: [contracts/openapi.yaml](contracts/openapi.yaml)
- Persistence rules and state transitions: [data-model.md](data-model.md)
- Security and stack rationale: [research.md](research.md)

## Presentation handoff

After all checks pass, create `.harness/app.json` with:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

This is an implementation-phase delivery step, not evidence by itself that the interactions above passed.

## Validation record — 2026-09-17

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, including URL/text validation, metadata parsing, network policy, transactional CRUD/tag behavior, duplicate detection, search/filtering, and the 1,000-bookmark response target.
- `npm run build`: passed with all application and API routes compiled.
- `npm run test:e2e`: passed in Chromium for the complete save/search/filter/edit/delete journey, metadata dirty/stale response protection, and automated WCAG A/AA checks.
- A live metadata preview against `https://example.com` returned its declared title through the pinned public-address fetcher; automated tests remain deterministic and do not depend on public sites.
- The application was verified at `http://127.0.0.1:4000/` with the required `data-harness-ready="true"` marker after initial data loading.
