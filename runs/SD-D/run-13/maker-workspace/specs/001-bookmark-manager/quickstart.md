# Phase 1 Quickstart and Validation Guide: Bookmark Manager

This guide defines how the completed feature will be built, started, and validated. It is not an implementation script; commands become runnable during the implementation phase.

## Prerequisites

- Node.js 24.x LTS and npm
- The repository's locked dependencies installed with `npm ci`
- Write access to `/work/data/` for the SQLite database
- Playwright 1.61.0 using the shared browsers at `/opt/playwright-browsers`

No external database, metadata service, login, or cloud account is required.

## Prepare and start

```bash
cd /work
npm ci
npm run db:migrate
npm run build
npm start
```

Expected outcome:

- One foreground server listens on `0.0.0.0:4000`.
- `GET http://127.0.0.1:4000/api/health` returns `{"status":"ok"}`.
- The client is available to the reviewer at `http://maker:4000/`.
- The root application element receives `data-harness-ready="true"` only after preferences and the initial bookmark view have resolved to loaded or a valid empty state.
- Restarting the process keeps previously committed bookmarks and preferences.

After implementation, `/work/.harness/app.json` must contain the prepared production start command:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

## Automated quality gates

Run the fast checks first:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:contract
```

Then build and run browser verification against the exact installed browser revision:

```bash
npm run build
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
npm run test:performance
```

Expected outcome:

- All commands exit successfully.
- Contract tests validate representative responses against `contracts/openapi.yaml` and the parser against `contracts/search-grammar.ebnf`.
- Browser tests cover desktop, a touch-phone profile, and an exact 320-pixel viewport.
- Accessibility scans report no automatically detectable serious or critical violations on primary routes or open editor/dialog states.
- The 1,000-bookmark benchmark keeps visible search, filter, sort, and state-change feedback inside the approved 1-second goal.

The browser suite starts a test-composed server with an injected deterministic metadata transport. This does not add a runtime switch or bypass to the production server.

## End-to-end acceptance walkthrough

### 1. Paste, retrieve, edit, and save

1. Open `/bookmarks/new`.
2. Paste a fixture address that exposes a title, description, icon, and preview.
3. Confirm progress is announced and the form stays editable.
4. Change the suggested title before retrieval completes in one test and after completion in another.
5. Confirm the user's title is never overwritten, all available visual details appear, and Save creates one bookmark.
6. Open the destination and confirm the app retains its collection position.
7. Restart the application and confirm the bookmark and processed assets remain.

Also return timeout, missing-field, and unsupported-image fixture outcomes. Each must preserve the address and allow manual title entry and saving.

### 2. Prevent duplicates in every state

1. Save a bookmark.
2. Paste URL variants that differ only by scheme/host case, default port, or empty path versus `/`.
3. Confirm no row is added and navigation reaches the existing active detail in at most one additional action.
4. Archive the bookmark and repeat; confirm navigation reaches the archived detail with Restore available.
5. Attempt to edit a second bookmark to the duplicate address; confirm the edit is blocked and the original remains unchanged.
6. Verify addresses with different non-root paths, queries, or fragments remain separate.

### 3. Search, tags, filters, and sort

Seed known bookmarks and verify these expressions against expected IDs:

```text
accessibility
"design systems"
tag:research
tag:"machine learning"
accessibility AND tag:research
accessibility tag:research
(design OR usability) AND tag:"work notes"
```

Confirm:

- ordinary terms match partial text across title, address, description, notes, and tags;
- phrases remain contiguous;
- tag conditions are exact after normalization;
- implicit and explicit AND agree;
- AND precedes OR and parentheses override it;
- malformed quotes/parentheses preserve the query and highlight the reported offset;
- the example/help affordance is keyboard reachable;
- favorite, selected-tag, and To read filters combine with the expression;
- title, date added, and date updated sort in both directions with stable ties;
- clearing query/filters preserves the selected sort, including after restart.

### 4. Reuse tags

1. Type part of an existing tag in the create and edit forms.
2. Confirm case-insensitive suggestions appear from active and archived bookmarks without duplicates.
3. Choose a suggestion with pointer, touch, and keyboard.
4. Remove the final use of a tag and confirm it no longer appears as a suggestion.

### 5. Manage To Read

1. Confirm a new bookmark defaults to not marked To read.
2. Mark it To read during creation and verify membership in both Active and To Read.
3. Mark it read from the To Read list and confirm it leaves that view without deletion.
4. Mark it To read again from details and confirm it returns.
5. Apply search, filters, and sorting in To Read and confirm they operate only on that subset.

### 6. Create and render formatted notes

1. Add multiple paragraphs, level-2/3 headings, bold, italic, lists, a quotation, and an HTTP(S) link.
2. Save and view the bookmark; confirm each approved format renders and is searchable as plain text.
3. Reopen the editor and confirm the structured note round-trips.
4. Attempt disallowed nodes, raw HTML, scriptable content, unsafe link protocols, excessive depth, and oversized content through API tests; each must be rejected without altering the saved note.
5. Operate the toolbar using its documented keyboard pattern and confirm state is announced.

### 7. Archive, restore, and delete

1. Give a bookmark tags, favorite state, a formatted note, and To read status.
2. Archive it and confirm it disappears from Active, favorites, active search, and To Read.
3. Find it in Archive using search and sort.
4. Restore it and confirm all details/states return, including To Read membership.
5. Request permanent deletion, cancel, and confirm no change.
6. Confirm deletion and verify the bookmark disappears from every view while shared media used by another bookmark remains intact.

### 8. Responsive and accessible operation

For `/`, `/to-read`, `/archive`, `/bookmarks/new`, one detail route, and one edit route:

- complete the primary flow using only the keyboard;
- confirm logical focus order, visible focus, labelled controls, status announcements, dialog focus containment/return, and a sensible focus target after an item leaves a list;
- test at 320 pixels with no horizontal page scrolling and no hidden core action;
- test phone touch targets and desktop layout using one semantic DOM hierarchy;
- run axe on the stable state and with tag suggestions, note toolbar, and delete confirmation open.

Automated checks must be supplemented by a manual screen-reader smoke test before release.

## Security verification

The injected resolver/transport test matrix must prove rejection of:

- loopback, private, link-local, multicast, reserved, IPv4-mapped IPv6, and special-use destinations;
- mixed public/private DNS answers and DNS rebinding between validation and connection;
- redirect loops, more than three redirects, HTTPS downgrade, and redirect to a blocked destination;
- credential-bearing retrieval URLs and unsafe ports;
- lying or absent content lengths, decompression/pixel bombs, slow response stages, unsupported content types, SVG, and MIME/signature mismatch;
- cross-origin write attempts and stored-script attempts in notes or metadata.

Verify that the actual connection uses the pinned vetted address while Host, TLS SNI, and certificate validation retain the original hostname. Errors shown to the user must be typed and actionable without exposing resolved addresses or raw network failures.

## Artifact references

- Product behavior: [spec.md](spec.md)
- Technical choices: [plan.md](plan.md) and [research.md](research.md)
- Persistence and transitions: [data-model.md](data-model.md)
- HTTP interface: [contracts/openapi.yaml](contracts/openapi.yaml)
- Search language: [contracts/search-grammar.ebnf](contracts/search-grammar.ebnf)
