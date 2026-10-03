# Quickstart and Validation Guide: Personal Bookmark Manager

This guide describes the intended setup and verification commands for the implementation phase. The commands become runnable after the approved plan is converted into tasks and implemented.

## Prerequisites

- Node.js 24.x and npm.
- The workspace-provided Chromium and Playwright browser assets at `/opt/playwright-browsers`.
- Writable local storage below `/work/data`.
- Optional SMTP credentials for manually receiving password-reset email. Automated tests use an injected in-memory mailer.

## Configure

```bash
npm ci
cp .env.example .env
```

Required local values:

```dotenv
NODE_ENV=development
HOST=0.0.0.0
PORT=4000
DATABASE_URL=/work/data/bookmarks.sqlite
APP_ORIGINS=http://maker:4000,http://127.0.0.1:4000
BETTER_AUTH_URL=http://maker:4000
BETTER_AUTH_SECRET=<at-least-32-random-characters>
MAIL_TRANSPORT=console
REVIEW_USER_EMAIL=review@example.com
REVIEW_USER_PASSWORD=<development-only-review-password>
REVIEW_USER_NAME=Review User
```

Production must replace `MAIL_TRANSPORT=console` with configured SMTP, use HTTPS origins, enable secure cookies, and store secrets outside the repository.

## Prepare the Application

```bash
npm run db:migrate
npm run seed:review
npm run build
```

Expected outcomes:

- Auth and application migrations complete without pending or partially applied files.
- The review seed is idempotent and creates only the explicitly configured development account.
- The production client and server builds complete with no type errors.

## Run

```bash
npm start
```

- Client review address: `http://maker:4000/`
- Automated/local container address: `http://127.0.0.1:4000/`
- The server listens on `0.0.0.0:4000`.
- The foreground start command serves the compiled application; it does not install, migrate, seed, or build.

## Automated Verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
```

The complete gate is:

```bash
npm test
```

Expected coverage:

- Unit: URL and name normalization, duplicate keys, title source rules, cursor handling, metadata parsing, and outbound-network policy.
- Component: authentication forms, save composer states, duplicate dialog, empty/error states, filters, edit, favorite, and delete confirmation.
- Integration: real migrations and SQLite constraints, Better Auth lifecycle, password recovery with fake mail, CSRF/origin checks, two-user isolation, REST contract, metadata race handling, and FTS consistency.
- Scale: 10,000-bookmark seed with all sorts/filters/search modes under the specified user-visible threshold.
- Browser: registration/sign-in/out/recovery UI, URL-only save, captured/fallback metadata, persistence, duplicate choices, organization, search, favorite, edit, and deletion on desktop and mobile viewports.

## Manual Acceptance Walkthrough

### 1. Fast URL-only save

1. Sign in with the seeded review account.
2. Paste a public page URL into the save composer without entering a title.
3. Confirm that a title and site icon appear within the bounded preview period.
4. Edit the title, save, refresh, sign out, and sign in again.
5. Confirm that the edited title and icon persist and opening the bookmark leaves it saved.

### 2. Fallback save

1. Enter a syntactically valid URL whose metadata fixture times out or is policy-ineligible.
2. Save before or after the preview finishes.
3. Confirm the bookmark uses a readable fallback title and generic icon.
4. Edit the fallback title and trigger metadata retry.
5. Confirm the user's title is never overwritten.

### 3. Duplicate warning

1. Attempt to save an address already in the current user's library.
2. Confirm the app offers View existing, Save another copy, and Cancel.
3. Verify Cancel creates nothing and Save another copy intentionally creates a second record.

### 4. Search and organization

1. Create multiple folders and tags and assign them to bookmarks.
2. Search by partial title, URL, and tag text.
3. Combine folder, tag, and favorite filters and change all three sort modes.
4. Verify no-match messaging and Clear filters.
5. Rename and delete a folder/tag; confirm bookmarks remain and results/counts update.

### 5. Maintenance

1. Favorite and unfavorite a bookmark.
2. Edit its address, title, notes, folder, and tags.
3. Cancel a deletion and confirm the bookmark remains.
4. Confirm a deletion and verify it disappears from all searches and filters.

### 6. Privacy and recovery

1. Create or seed a second user.
2. Verify direct IDs, searches, folder/tag filters, metadata retry, and icon routes never expose the first user's data.
3. Request password recovery for both known and unknown emails and confirm the visible responses match.
4. Use the test/console-delivered link, reset the password, and confirm older sessions are revoked.

## Review Harness

After build, migration, and seed succeed, implementation writes `/work/.harness/app.json`:

```json
{
  "kind": "application",
  "port": 4000,
  "path": "/",
  "start_command": ["npm", "start"],
  "start_cwd": "/work"
}
```

The signed-out page or fully loaded library/empty state must include `data-harness-ready="true"`. Loading and error placeholders must not include it.

## Implementation verification record

Validated on 2026-09-18 with Node 24:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 24 files and 60 tests passed, including real temporary SQLite, two-user isolation, metadata policy, and a 10,000-bookmark fixture.
- `npm run test:e2e`: the URL-only save/revisit, organization, maintenance, and responsive readiness journeys passed in desktop and mobile Chromium 1.61.0.
- `npm audit --audit-level=moderate`: zero known vulnerabilities.
- `npm run build`: production client assets built successfully.
- SMTP delivery was not exercised against an external provider; the injected in-memory delivery and single-use reset flow were verified. Production startup rejects non-SMTP mail configuration.
