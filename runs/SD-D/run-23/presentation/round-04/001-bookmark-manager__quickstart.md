# Quickstart and Validation Guide: Bookmark Manager

This guide describes the planned runnable interface and the acceptance checks to execute after implementation. Commands intentionally correspond to the future package scripts; they are not implementation in this planning phase.

## Prerequisites

- Node.js 24.21.x and npm 11+
- The Playwright 1.61.0 browser available at `/opt/playwright-browsers`
- Write access to `data/` and the configured media-cache directory
- Outbound HTTP(S) access for live metadata checks; controlled fixtures are used in automated security tests

## Prepare

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed:review
npm run build
```

Required review configuration:

```text
APP_HOST=0.0.0.0
APP_PORT=4000
DATABASE_PATH=./data/bookmarks.db
MEDIA_CACHE_PATH=./data/media-cache
SESSION_KEY=<generated secret, never committed>
REVIEW_USER_EMAIL=review@example.test
REVIEW_USER_PASSWORD=<local review password>
```

`db:seed:review` creates or updates only the explicitly configured local review account. Production environments must provision accounts and secrets separately.

## Verify before starting

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
```

High-risk automated suites must cover:

- tenant isolation on every repository and API path, including unary `NOT` searches;
- URL normalization and duplicates across active and archived bookmarks;
- phrase/operator precedence, invalid-query source spans, Unicode, punctuation, and FTS injection strings;
- FTS trigger consistency after create, edit, notes changes, archive, restore, and delete;
- metadata redirects to private addresses, mixed public/private DNS answers, rebinding, redirect loops, timeouts, oversized responses, non-HTML bodies, malformed metadata, and partial results;
- safe Markdown rendering and blocked raw HTML/script/link schemes;
- stale bulk preview rejection and exact counts across more than one result page;
- saved-view behavior after tag rename and deletion;
- desktop and mobile keyboard-accessible confirmation flows.

## Start

```bash
npm start
```

The server must listen on `0.0.0.0:4000`. Use:

- Client review: `http://maker:4000/`
- Local automated capture: `http://127.0.0.1:4000/`

The visible application shell receives `data-harness-ready="true"` only after the session check and initial library query have resolved to a valid app, empty, or sign-in state.

## End-to-end acceptance walkthrough

### 1. Sign in and save rich metadata

1. Sign in with the configured review account.
2. Paste a controlled public fixture URL that publishes title, description, icon, and Open Graph image.
3. Confirm details appear within five seconds, change the title, add notes, and save.
4. Repeat with fixtures that omit metadata, time out, and redirect to a blocked private destination.

Expected: partial/failed retrieval never blocks saving; user edits are not overwritten; blocked destinations are reported without disclosing internal network data.

### 2. Read-later and archive lifecycle

1. Confirm a new bookmark starts unread.
2. Mark it read and verify it leaves Unread but remains in the library.
3. Open its external destination and confirm that opening alone does not change read state.
4. Archive it, find it only in Archive, then restore it.

Expected: title, notes, tags, collection, metadata, and read state survive archive/restore unchanged.

### 3. Advanced search and notes

Create fixtures for research, design, and unrelated content, including searchable notes and multi-word tags. Exercise:

```text
distributed systems
"distributed systems"
tag:research
tag:"machine learning" AND "paper queue"
(tag:research OR tag:design) NOT obsolete
```

Expected: adjacency means AND, quotation means token phrase, grouping changes precedence, tags resolve exactly, notes match, and invalid syntax points to the problematic input without clearing it.

### 4. Tag suggestions and organization

1. Create `Research` and `Reading List` tags.
2. Type partial text while editing another bookmark.
3. Rename a tag and delete a collection after reviewing its affected count.

Expected: suggestions prefer prefix matches, case variants do not create duplicates, rename propagates, and label deletion never deletes bookmarks.

### 5. Bulk scope and stale confirmation

1. Create more bookmarks than fit one page.
2. Filter them and choose all matches.
3. Preview a read-state or tag action and verify the complete matching count.
4. Change the library in a second session before executing the original preview.
5. Refresh the preview, execute, then test archive, restore, and permanent delete.

Expected: stale scope returns a conflict and changes nothing; refreshed actions report exact successes/failures; deletion and archive are visibly distinct.

### 6. Saved views

1. Save a named view containing a Boolean query, tags, read filter, location, and sort.
2. Add a newly matching bookmark and reopen the view.
3. Rename a referenced tag, then delete it.

Expected: the new bookmark appears because results are live; rename remains valid; deletion produces an unavailable-criterion warning and never broadens results silently.

## Runtime handoff after implementation

After successful build and verification, write:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

to `.harness/app.json`. If startup configuration or built code changes, stop the old server before requesting another review. Inspect `.harness/runtime/server.log` after any failed start.

