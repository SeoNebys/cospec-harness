# Quickstart and Validation Guide: Bookmark Manager

This guide defines the required local build, run, and end-to-end validation flow for the implementation derived from this plan. The commands become runnable after `speckit-tasks` and `speckit-implement` create the application; no application code exists at the planning gate.

## Prerequisites

- Node.js 24.x and npm
- The repository dependencies installed from `package-lock.json`
- Chromium supplied at `/opt/playwright-browsers`
- A writable application data directory
- Network access only for metadata scenarios that explicitly use public pages; deterministic automated tests use local controlled fixtures

## Configuration

The implementation must document these variables in `.env.example` without committing secrets:

| Variable | Purpose | Local/review value |
|---|---|---|
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Application port | `4000` |
| `BOOKMARKS_DATA_DIR` | SQLite/runtime data directory | `/work/data` |
| `BOOKMARKS_PASSWORD_HASH` | Versioned `scrypt` owner-password envelope | Generated command output |
| `COOKIE_SECURE` | Require HTTPS-only session cookie | `false` only for shared HTTP review; production defaults to `true` |
| `TRUST_PROXY` | Explicit trusted proxy mode | `false` locally; deployment-specific in production |
| `LOG_LEVEL` | Redacted application logging | `info` |

Generate a review password hash after implementation:

```bash
npm ci
npm run auth:hash
```

Enter `review-bookmarks` at the non-echoing prompt, then copy the printed envelope into `BOOKMARKS_PASSWORD_HASH`. That password is only for the shared review environment and must not be reused for production.

## Prepare and Start

```bash
mkdir -p /work/data
npm run db:migrate
npm run build
npm start
```

Expected startup behavior:

- The server listens on `0.0.0.0:4000`.
- `GET /health/ready` returns success only after configuration validation, migrations, database integrity checks, and background-job recovery finish.
- The login page is available to the client at `http://maker:4000/`.
- The browser uses `http://127.0.0.1:4000/` for VM capture and automated review.
- A visible application root receives `data-harness-ready="true"` only after the valid login, empty, or populated state is ready—not on a loading or fatal-error placeholder.

The implementation must write `/work/.harness/app.json` after build preparation:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

## Automated Verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e
npm run test:performance
```

Expected coverage:

- Unit/property suites cover query grammar, normalization, metadata precedence, URL/IP safety, Markdown policy, state transitions, bookmark HTML escaping, and import/export round trips.
- Integration suites use temporary real SQLite files and controlled HTTP/DNS fixtures for migrations, constraints, transactions, sessions/CSRF, SSRF rejection, imports, exports, and job recovery.
- Contract tests validate every response against `contracts/openapi.yaml` and validate search/import-export behavior against their dedicated contracts.
- Playwright is pinned exactly to 1.61.0 and uses the installed Chromium. It covers desktop/mobile layouts, keyboard-only operation, focus restoration, downloads/uploads, reload persistence, and the readiness marker.
- Performance tests seed fixed 10,000-bookmark and 1,000-selection datasets and fail when approved thresholds are exceeded.

## Manual Acceptance Walkthrough

### 1. Enriched save and duplicate prevention

1. Sign in with the review password.
2. Paste a controlled reachable page URL exposing a title, description, and icon.
3. Confirm progress appears and the three proposals arrive within the test budget.
4. Edit the title while retrieval is pending; verify a late response does not replace it.
5. Remove the icon, add tags and a note, then save.
6. Paste the exact URL again; verify the app identifies and links to the existing bookmark without creating another.
7. Repeat with a blocked/private/unreachable metadata target; verify a valid URL remains manually saveable and no unsafe socket is opened.

### 2. Readable note formatting

Enter this note:

```markdown
This is **important** and *worth revisiting*.

- First idea
- Second idea

1. Read
2. Summarize

[Source](https://example.com/)
```

Outside edit mode, verify emphasis, paragraphs, lists, and the link render without raw formatting markers. Verify raw HTML, image syntax, and a `javascript:` link cannot execute or load content and remain readable or are safely omitted according to the note contract.

### 3. Search, unread, and archive

1. Seed bookmarks whose fields and tags distinguish `climate`, the phrase `climate policy`, and tag `research`.
2. Verify plain terms, quoted phrases, `tag:research`, implicit `AND`, and explicit `AND`/`OR`/`NOT` results.
3. Enter an unmatched quote and dangling operator; verify the query is preserved and the exact source span is explained.
4. Mark a bookmark read and unread and verify the active unread view.
5. Archive it and verify it disappears from active/unread, remains searchable in Archive, retains read status, and restores correctly.

### 4. Bulk operations

1. Filter to a known result set and select individual rows, then select all matching results.
2. Add and remove a tag; verify unrelated tags remain.
3. Mark read/unread, archive, and restore; verify the result count and cleared selection after each operation.
4. Start bulk permanent deletion; verify the confirmation states the count. Cancel once, then confirm and verify removal.
5. Change search criteria with a selection active; verify hidden selection is cleared.

### 5. Import and export

1. Upload fixtures for Chrome/Chromium, Firefox, Safari/Edge-compatible structure, malformed nesting, invalid URLs, within-file duplicates, and existing-library duplicates.
2. Verify folder levels become tags, counts are previewed before mutation, and cancel leaves the library unchanged.
3. Confirm import and verify bookmarks are immediately usable while missing metadata enriches later without replacing imported values.
4. Export a collection containing active/archived, read/unread, tags, formatted notes, descriptions, dates, and an icon.
5. Open the export in a generic compatible tool/fixture parser and verify every title/URL appears once.
6. Import the export into an empty database and compare all fields required by FR-042.

### 6. Persistence and privacy

1. Restart the server after creating, editing, archiving, and importing data; verify state persists and interrupted jobs recover.
2. Verify unauthenticated API and icon requests are denied.
3. Verify session cookies are HttpOnly/SameSite and mutation requests without valid origin/CSRF proof fail.
4. Inspect logs to confirm URLs with paths/query strings, notes, descriptions, passwords, session values, and imported content are absent.

## Performance and Durability Gates

The following are release-blocking:

| Gate | Required outcome |
|---|---|
| Metadata | Exposed values proposed within 5 seconds for at least 95% of the representative reachable fixture set |
| Search/view | Each query, filter, sort, and collection switch completes within 2 seconds at 10,000 bookmarks |
| Bulk | A 1,000-bookmark status/tag action reports within 5 seconds with no unintended field change |
| Import | 10,000 valid bookmarks commit within 60 seconds and reported counts are exact |
| Round trip | Export to empty-app import restores 100% of required bookmark fields |
| Persistence | 100 leave/restart cycles lose no confirmed changes |
| Validation | All invalid/unsupported/duplicate address fixtures are rejected with actionable feedback |

If the substring search benchmark misses its threshold, enable the researched FTS5-trigram fallback behind the existing AST, then rerun semantic equivalence and performance suites before accepting the change.
