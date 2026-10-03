# Quickstart and Validation Guide: Bookmark Management

This is the planned run and acceptance guide. Commands become executable during implementation; their presence here does not indicate that application code exists yet.

## Prerequisites

- Node.js 24 LTS and npm
- Linux/macOS shell or equivalent
- Writable local directories for the SQLite database and normalized icon store
- Chromium from the provided Playwright 1.61.0 installation
- Production only: HTTPS base URL and SMTP/provider credentials for verification and password-recovery email

No external database is required for the initial release.

## Configuration

Implementation will provide `.env.example` with at least these categories:

| Setting | Purpose |
|---|---|
| Application base URL | Trusted origin used for cookies, CSRF/origin checks, and recovery links |
| Authentication secret | Session/authentication signing or encryption material |
| Database path | Persistent SQLite file below the application data directory |
| Icon path | Persistent normalized-icon directory |
| Email transport | Production SMTP/provider or local/test capture mode |
| Metadata limits | Optional overrides for documented fetch rate/concurrency bounds |

Secrets, recovery tokens, session identifiers, and private bookmark content must not be logged or committed.

## Planned Setup and Run

```bash
npm ci
npm run db:migrate
npm run seed:review
npm run build
npm start
```

`npm start` must run the prepared build on `0.0.0.0:4000`. The review URL is `http://maker:4000/`; automated browser capture uses `http://127.0.0.1:4000/`.

After implementation and build verification, `/work/.harness/app.json` must contain:

```json
{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}
```

The first valid page (login, authenticated application, or valid empty state) adds `data-harness-ready="true"` only after required data has loaded. Loading and error placeholders do not carry the marker.

## Planned Automated Checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:component
npm run test:integration
npm run test:contract
npm run test:e2e
npm run test:performance
npm run build
```

Expected scope:

- Unit: URL/tag normalization, search lexer/parser/compiler, state transitions, metadata precedence/fallback, note plain-text extraction, and validation limits.
- Component: capture form, search errors, selection/bulk bar, note editor/preview, destructive confirmation, empty/error states, keyboard and focus behavior.
- Integration: migrated temporary SQLite database, uniqueness across archive state, owner isolation, FTS synchronization, bulk transaction outcomes, authentication/recovery callbacks, and icon lifecycle.
- Contract: every `contracts/openapi.yaml` response shape, authentication/CSRF requirements, safe not-found behavior, and `contracts/search-query.md` grammar/error examples.
- End-to-end: all approved user stories, two-account isolation, persistence across sign-out/sign-in, responsive layouts, and automated accessibility checks.
- Performance: 10,000-bookmark list/search/filter/sort scenarios and a 100-item bulk action against a release build.

## Acceptance Walkthrough

### 1. Account privacy and recovery

1. Create and verify two accounts.
2. Save a bookmark as Account A.
3. Confirm Account B cannot view, edit, icon-fetch, bulk-update, archive, or delete Account A's bookmark even when given its ID.
4. Request a password reset using local/test email capture.
5. Confirm the response does not reveal whether an account exists, the token expires and is single-use, reset revokes old sessions, and the new password works.

Expected: account and collection isolation holds at UI and direct-request levels.

### 2. Automatic page details and duplicate handling

1. Paste a public fixture URL publishing an Open Graph title, description, and raster icon.
2. Confirm all three proposals appear before save.
3. Edit the title and description, save, sign out/in, and confirm the edits persist.
4. Change the address to another fixture and refresh metadata; confirm edited text is not silently overwritten.
5. Attempt to save the first normalized URL again, first while active and then after archiving it.

Expected: retrieval is automatic, partial failure never blocks a valid save, and duplicate attempts warn and navigate to the existing active/archived bookmark.

### 3. Metadata security and fallback

Run integration fixtures covering loopback/private/link-local/reserved addresses, mixed public/private DNS, DNS rebinding, public-to-private redirects, redirect loops, timeouts, oversized/compressed bodies, non-HTML responses, and malformed HTML.

Expected: no request reaches an internal canary; every unsafe/failed retrieval returns a safe category and fallback title; the user can still save a valid public URL. Icons are always same-origin normalized PNGs or the generic fallback.

### 4. Rich notes

1. Add headings, bold/italic text, ordered/unordered lists, a quotation, an HTTP(S) link, inline code, and a code block.
2. Toggle edit/readable views, save, reload, and edit again.
3. Search for text found only in the note.
4. Enter raw HTML, script/event markup, unsafe link protocols, SVG/MathML payloads, and tags inside code fences.

Expected: approved formatting and search work; raw/active content never executes or loads; unsafe link labels remain readable but are not clickable.

### 5. Search grammar

Seed overlapping titles, URLs, descriptions, notes, and tags. Verify:

- Ordinary adjacent terms require both terms.
- `tag:research` and `tag:"machine learning"` match exact normalized tag names.
- Quoted phrases match in order within one field.
- `NOT`, `AND`, `OR`, and parentheses follow documented precedence.
- Operators inside quotes remain text.
- Malformed input identifies the position, preserves the original input, and offers a correction.
- Searches remain within active, unread, or archive view and the authenticated owner.

Expected: results match [the search contract](contracts/search-query.md) and retain the selected product sort.

### 6. Read-later and archive transitions

1. Add an active bookmark to read later; confirm it appears in unread.
2. Mark it read; confirm it leaves unread but remains in the active collection.
3. Mark it unread again and archive it; confirm it disappears from active and unread.
4. Restore it; confirm it returns active and unread with its note/tags intact.
5. Remove it from read-later tracking; confirm it remains bookmarked with state `none`.

Expected: archive state is orthogonal to reading state as defined in `data-model.md`.

### 7. Bulk actions and permanent deletion

1. Select individual rows and all currently visible results; confirm count and clear behavior.
2. Change the filter while selected and verify hidden-selection behavior is explicit.
3. For up to 100 IDs, add/remove tags, mark read/unread, archive, and restore.
4. Include a stale or other-user ID and confirm it is safely reported as not found without owner disclosure.
5. Request permanent deletion and verify the dialog states item count and irreversibility.
6. Cancel once, then confirm. Attempt to restore deleted IDs.

Expected: per-item outcomes are accurate, storage faults roll back uncertain changes, cancellation preserves all items, and confirmed deleted items cannot be restored.

### 8. Failure, accessibility, and responsive behavior

1. Inject save/search/bulk/database failures and confirm the interface never claims success, preserves valid input, and offers retry where possible.
2. Navigate every primary flow by keyboard, verifying visible focus, dialog focus management, labels, error association, and status announcements.
3. Run automated accessibility scans and manually inspect narrow mobile and desktop layouts.

Expected: all primary flows remain understandable and operable without a pointer; valid empty states are distinct from loading/errors.

## Performance Evidence

Seed one account with 10,000 bookmarks spanning notes, tags, reading states, and archives. Against a production build:

- Record 20 or more representative runs for initial list, each sort, tag filter, unread/archive view, plain search, phrase search, Boolean/tag query, and pure-negative query.
- Confirm at least 95% present usable results within 2 seconds in the controlled test environment.
- Confirm a user can locate/open the target bookmark within the separate 10-second usability criterion.
- Apply each bulk operation to 100 IDs and confirm completion within 30 seconds.
- Inspect query plans/index use for regressions, but report user-visible timings as the success evidence.

Local results are development evidence, not a claim about an unmeasured production deployment.

## Operational Verification

Before review or release:

1. Apply migrations to a clean database and to a copy of the previous schema.
2. Back up the SQLite database consistently with its WAL state and the icon store.
3. Restore into a clean data directory and verify counts, a sample search, notes, reading/archive state, and icons.
4. Confirm production rejects missing secrets, insecure recovery base URLs, and production use of the local/test email transport.
5. Confirm logs contain request IDs and safe result categories but no private URLs, note text, passwords, session identifiers, CSRF values, or reset tokens.
