# Quickstart and Validation Guide

This guide defines how the completed implementation will be built, run, and verified. Commands become runnable during the implementation phase; this planning phase does not create application code.

## Prerequisites

- Node.js 24.21.x and npm 11.x
- Linux-compatible build tools for dependency installation
- The Playwright 1.61.0 browser bundle available at `/opt/playwright-browsers`
- Port 4000 free for the final application

No external database, account provider, or search service is required. Network access is needed only for live page-detail retrieval and opening saved destinations.

## Install and prepare

```bash
npm ci
npm run db:migrate
npm run build
```

Migrations create the local SQLite database beneath `var/`. The database file and runtime journals are ignored by version control.

## Start the prepared application

```bash
npm start
```

Expected behavior:

- The server listens on `0.0.0.0:4000`.
- `GET http://127.0.0.1:4000/api/health` returns `{"status":"ready"}`.
- The client is reviewable at `http://maker:4000/`.
- The valid loaded or empty app shell carries `data-harness-ready="true"`.

The implementation will write this runtime declaration after a successful build:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

## Automated verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
npm run test:performance
```

Expected outcome: every command exits successfully. The performance fixture contains 5,000 bookmarks and verifies complete valid query results within the approved two-second limit, with a 250 ms internal database-search target on the project test environment.

## End-to-end acceptance walkthrough

### 1. URL-only save and metadata

1. Open the empty collection and choose to add a bookmark.
2. Paste a fixture URL that provides an HTML title, standard description, and favicon.
3. Verify all three details appear without manual entry.
4. Edit the title while a delayed metadata response is pending; verify the late response does not overwrite the edit.
5. Save and reload; verify the bookmark and app-owned icon remain.
6. Repeat with timeout, missing metadata, unsupported content type, and broken-icon fixtures; verify hostname title, empty description, placeholder icon, and non-blocking warnings.
7. Attempt the final redirected URL again; verify duplicate prevention identifies the existing bookmark.

### 2. Metadata safety

Use the controlled integration transport to cover loopback/private/link-local/metadata/CGNAT/multicast/reserved destinations, IP encodings, mixed DNS answers, DNS rebinding, public-to-private redirects, redirect loops, oversized/compressed bodies, slow streams, and unsafe favicon redirects.

Expected behavior: policy-unsafe destinations are rejected and cannot be saved; ordinary availability/content failures remain saveable with fallbacks; no response exposes internal addresses or stack traces. See [the API contract](contracts/openapi.yaml) for stable codes.

### 3. Advanced search

Seed bookmarks whose fields and tags distinguish each operator, then verify:

```text
recipes vegan
#recipes AND "olive oil"
python OR rust AND web
(python OR rust) AND NOT "beginner guide"
#"machine learning" NOT video
```

Expected behavior follows [the search grammar](contracts/search-grammar.md): exact hashtags, contiguous phrases, implicit `AND`, `NOT > AND > OR` precedence, grouping, case-insensitive Unicode-normalized matching, and filters conjoined with the query. Invalid quotes, groups, tags, and operators retain the query and highlight the reported span.

### 4. Tags

1. Seed `recipes` and `research`.
2. Enter `re` in the tag field.
3. Verify both existing tags are suggested without case sensitivity.
4. Select one using Arrow keys and Enter; verify focus remains useful.
5. Verify a selected tag disappears from suggestions and cannot be duplicated.
6. Enter a genuinely new label; verify it is created once in normalized form.

### 5. Favorite and unread independence

1. Mark a bookmark as both favorite and unread.
2. Open its destination and return; verify it remains unread and the prior search/filter view remains.
3. Remove favorite; verify unread remains.
4. Filter to unread only, explicitly mark the bookmark read, and verify it leaves that view but remains in the full collection.

### 6. Edit and delete

1. Edit title, description, personal notes, URL, and tags; reload and verify persistence.
2. Attempt an edit to another bookmark's normalized URL; verify duplicate conflict feedback and no data loss.
3. Request deletion, cancel, and verify the bookmark remains.
4. Confirm deletion and verify the bookmark disappears and orphaned relationships/assets are cleaned up.

### 7. Accessibility and resilience

Complete create, metadata review, tag selection, advanced search, favorite/unread toggles, edit, and deletion using only the keyboard. Verify visible focus, no focus trap, dialog focus restoration, accessible names, and live announcements for progress/errors. Run automated axe checks on empty, populated, dialog, suggestion, no-results, and error states, while treating them as supplements to the interaction tests.

## Contract references

- [Feature specification](spec.md)
- [Implementation plan](plan.md)
- [Data model](data-model.md)
- [REST API](contracts/openapi.yaml)
- [Search language](contracts/search-grammar.md)
