# Quickstart and Validation Guide: Bookmark Manager

This guide describes how to run and validate the application after implementation. It does not authorize implementation before the plan gate is approved.

## Prerequisites

- Node.js 24 LTS and its bundled npm
- Linux build tools if the platform cannot use the packaged SQLite native binary
- Chromium already installed at `/opt/playwright-browsers`
- Writable local `data/` directory
- Port 4000 available

## Install and prepare

From `/work`:

```bash
npm ci
npm run db:migrate
npm run build
```

Expected results:

- The lockfile installs without downloading a different Playwright browser revision.
- Migrations create or update `data/bookmark-manager.sqlite`, enable foreign keys and WAL, and report the applied schema version.
- The production client and server compile with no type errors.

## Run the prepared application

```bash
HOST=0.0.0.0 PORT=4000 npm start
```

The review entry point is `http://maker:4000/`. The health endpoint is `http://maker:4000/api/health`. The rendered application adds `data-harness-ready="true"` to a visible application shell only after the initial bookmark request has completed successfully, including a valid empty state.

## Automated verification

Run the complete non-browser suite:

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:contract
```

Run browser, accessibility, and target-scale verification:

```bash
npm run test:e2e
npm run test:accessibility
npm run test:performance
```

Expected results:

- Unit tests cover URL/tag normalization, note-schema validation and plain-text extraction, search tokenization/parsing/precedence, safe address classification, metadata selection priorities, and fallback-title generation.
- Integration tests run real migrations against temporary SQLite files and exercise duplicate handling, FTS updates, exact tags, archive/read-state transitions, preview expiry, and bulk completion summaries.
- Contract tests verify implemented routes and payloads against [openapi.yaml](./contracts/openapi.yaml) and exercise the behavior in [search-grammar.md](./contracts/search-grammar.md).
- End-to-end tests use Playwright 1.61.0 with the image's existing Chromium revision.
- Accessibility tests combine axe scans with explicit keyboard, focus, live-status, dialog, and autocomplete behavior.
- Performance tests seed 10,000 bookmarks and verify the targets in the approved specification; they report distributions, not just a single sample.

## End-to-end acceptance walkthrough

### 1. Automatic page details and fallback

1. Open the create panel and paste a fixture URL containing Open Graph title, description, icon, and image.
2. Confirm a progress state appears and the complete preview resolves within the test budget.
3. Edit the retrieved title and description, mark the item unread, add tags, and save.
4. Reopen the item and verify edited text plus cached local images remain.
5. Repeat with timeout, unsupported-content, and blocked-address fixtures; confirm each produces an explanation, generated title, and a usable save action.
6. Attempt the saved URL again and verify the existing bookmark is identified instead of duplicated.

### 2. Read-later states

1. Save two unread bookmarks and one ordinary bookmark.
2. Open the unread view and confirm only the two unread items appear.
3. Open one destination and confirm it remains unread.
4. Mark it read and confirm it leaves the unread view but remains active.
5. Mark it unread again and confirm it returns.

### 3. Search, direct tag filtering, and sorting

1. Seed records that distinguish ordinary terms, exact phrases, tags, and excluded terms.
2. Verify `#research`, `"design systems"`, `design AND NOT debt`, and `(design OR ux) AND #research` against the expected IDs.
3. Enter invalid syntax and verify the query stays visible with a useful error range and help.
4. Activate a tag displayed on a card and confirm the exact visible tag filter is applied immediately without editing the query.
5. Combine query, tag, and unread criteria; verify intersection semantics.
6. Verify title A–Z/Z–A and saved-date oldest/newest orders, including stable ordering for ties.

### 4. Tag reuse

1. Save bookmarks tagged `Research`, `product design`, and `inspiration`.
2. In another bookmark, type `res` and confirm `Research` appears first as a prefix match.
3. Type `design` and confirm `product design` appears as a substring match.
4. Confirm already assigned tags are excluded, suggestions work with keyboard and pointer, and choosing a suggestion reuses the existing tag.
5. Enter a genuinely new label and confirm it is normalized, saved, and suggested on the next bookmark.

### 5. Formatted notes

1. Create a note containing plain text, bold, italic, a safe link, a bulleted list, and a numbered list.
2. Save and confirm it renders without editing notation or raw HTML.
3. Search for readable list text and confirm the bookmark matches.
4. Submit disallowed nodes, attributes, protocols, and over-limit text through an integration test and confirm validation rejects them.

### 6. Bulk organization and safe deletion

1. Select several active bookmarks and confirm the selection count.
2. Add and remove tags without changing unrelated tags.
3. Mark the selection unread and then read; verify every eligible item and the completion summary.
4. Archive the selection and confirm it moves to the archived view with details intact.
5. Restore part of the selection.
6. Initiate deletion for archived items, cancel once, then confirm; verify the dialog count, archive-only enforcement, and final summary.
7. Change views or start a different search with items selected and verify selection clears with an accessible notice.

### 7. Keyboard and responsive review

1. Complete every workflow above without a pointer.
2. Confirm visible focus, logical focus order, labeled controls, reachable tag suggestions, focus containment/restoration for dialogs, and announced async/bulk status.
3. Repeat the primary save, search, read-later, and edit flows at narrow and wide viewport sizes.
4. Run axe after opening the create/edit panel, tag suggestions, search error/help, and delete confirmation—not only on the initial page.

## Metadata safety verification

Use injected transport fixtures and address-classification tests; do not weaken production policy to let tests fetch localhost.

Verify:

- HTTP(S) is accepted; file, data, FTP, and credential-bearing URLs are rejected or skipped as contracted.
- IPv4, IPv6, mapped-address, loopback, private, link-local, multicast, documentation, and reserved ranges never receive a metadata connection.
- All A/AAAA answers and every redirect hop are revalidated, and the connected address is the validated/pinned result.
- Redirect loops, excessive hops, slow bodies, oversized bodies, misleading content types, malformed HTML, and unsafe image types end with bounded partial/fallback results.
- No page scripts execute, no inbound user credentials are forwarded, and cached assets are served only under their stored allowlisted media type.

## Performance evidence

The performance suite must create a deterministic 10,000-bookmark database containing varied note text and tags, warm the application through normal use, and report at least 100 samples for search/filter/sort interactions. At least 95% must be visible within one second. A separate scenario applies each supported non-delete bulk action to 100 bookmarks and verifies completion plus accurate IDs within 30 seconds. Metadata timing uses controlled external-style fixtures through the injected safe transport so results are repeatable.

## Runtime handoff after implementation

After all checks pass, write `/work/.harness/app.json` as:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

Do not write this handoff file during planning. If startup code or arguments change during implementation, stop any old server before asking for another review.
