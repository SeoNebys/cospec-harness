# Validation Quickstart: Personal Bookmark Manager

This guide defines the expected implementation and review checks. Commands become runnable after the task and implementation phases create the application.

## Prerequisites

- Node.js 24 LTS and npm
- Chromium supplied by the workspace at `/opt/playwright-browsers`
- A writable `data/` directory
- No dependency on public websites during automated tests

## Prepare and Run

```bash
npm ci
npm run build
npm test
npm run test:e2e
npm start
```

The production server must listen on `0.0.0.0:4000`, serve the client and API from one process, and expose a loaded visible element with `data-harness-ready="true"`. Reviewers use `http://maker:4000/`; browser automation uses `http://127.0.0.1:4000/`.

## Automated Validation Layers

1. Unit tests prove URL normalization, public-address classification, redirect decisions, metadata precedence/fallbacks, search parsing/normalization, malformed-query spans, state transitions, and field validation.
2. Integration tests use temporary SQLite files and Fastify request injection to prove migrations, transactions, duplicate conflicts, CRUD, tag reconciliation, combined search, read-later views, and stable error envelopes.
3. Component tests prove keyboard operation, focus behavior, editable metadata suggestions, loading/failure feedback, confirmations, active search descriptions, and accessible status announcements.
4. Playwright tests use local metadata fixture pages and prove each end-to-end scenario below. Pin `@playwright/test` to 1.61.0.

## End-to-End Review Scenarios

### 1. Automatic metadata and fallback

- Paste a fixture URL that publishes title, description, and icon.
- Confirm all three suggestions appear within five seconds and can be edited before save.
- Save and reload; confirm edited values persist.
- Paste valid fixture URLs with partial metadata and with an intentional timeout.
- Confirm each remains saveable, unavailable fields are explained, and a useful title fallback is present.
- Confirm private, loopback, credential-bearing, and redirect-to-private URLs are rejected before any protected destination is contacted.

### 2. Duplicate handling

- Save a URL, then attempt variants differing only by scheme/host case, default port, or fragment.
- Confirm a duplicate response links to the existing bookmark and no second record is created.

### 3. Search contract

- Seed overlapping titles, descriptions, notes, URLs, and tags.
- Verify `Rome`, `"ancient Rome"`, `tag:book`, `tag:"science fiction"`, and `Rome tag:(article|book)` against the expected sets.
- Verify quoted phrases remain within one field, tag conditions do not match non-tag text, and repeated terms do not duplicate results.
- Enter each malformed form documented in [search-grammar.md](contracts/search-grammar.md); confirm a correction message identifies the relevant span.
- Combine structured query, selected tag filters, and each allowed sort order.

### 4. Read-later queue

- Add ordinary and read-later bookmarks.
- Confirm new read-later items are unread and the dedicated view contains only unread read-later items.
- Mark an item read, confirm it leaves that view but stays in the library, then mark it unread and confirm it returns.
- Remove it from read later and confirm its state becomes ordinary.

### 5. Editing, deletion, and persistence

- Edit every user-controlled field and confirm metadata is not silently refreshed.
- Cancel deletion once, then confirm deletion and verify all associations disappear.
- Restart the server and confirm all remaining bookmarks, tags, and reading states persist.

### 6. Accessibility and responsive use

- Complete save, search, filter, read-later, edit, and delete using only a keyboard.
- Confirm focus is visible and returns predictably after dialogs or item removal.
- Confirm labels, validation messages, retrieval status, and operation results are exposed to assistive technology.
- Repeat primary flows at desktop and narrow mobile viewport sizes without hidden actions or horizontal page overflow.

## Contract References

- REST contract: [openapi.yaml](contracts/openapi.yaml)
- Search language: [search-grammar.md](contracts/search-grammar.md)
- Persistence and state rules: [data-model.md](data-model.md)
