# Verification Record: Bookmark Manager

**Date**: 2026-09-27  
**Runtime**: Node.js 24, Chromium supplied at `/opt/playwright-browsers`

## Release gates

| Gate | Result |
|---|---|
| Clean dependency install | `npm ci --legacy-peer-deps` passed |
| Dependency audit | 0 known vulnerabilities |
| Lint and TypeScript | Passed |
| Prettier check | Passed |
| Unit/integration/contract suite | 15 files, 23 tests passed |
| Dedicated contract suite | 2 files, 2 tests passed |
| Performance suite | 4 files, 4 tests passed |
| Production client/server build | Passed |
| Fresh migration | Passed; 6 append-only migrations applied |
| Desktop Chromium workflow | Passed |
| Desktop and mobile axe checks | Passed with no serious/critical findings |

## Measured scenarios

- A 10,000-bookmark substring/phrase search, filter, sort, and view completed below the two-second gate.
- A transactional 1,000-bookmark bulk update completed below the five-second gate and preserved unrelated notes and tags.
- A 10,000-entry browser HTML import preview and commit completed below the sixty-second gate with exact counts and immediate availability.
- One hundred database close/reopen cycles retained the confirmed bookmark and passed SQLite `quick_check` on every cycle.
- A full Larder HTML export imported into an empty database with description, note source, tags, read status, archive state, and timestamps preserved.
- The live hardened metadata requester successfully retrieved `https://example.org` with DNS validation and socket pinning. Deterministic parser and policy behavior is covered by automated tests; no claim is made about universal third-party-site availability.

## Browser journey

The Chromium journey signs in, saves a bookmark with note and tags, performs an exact phrase plus tag Boolean search, marks it read, archives it, reopens it from Archive, verifies rendered bold note text, and downloads the browser-compatible export. Axe runs on the login and library states at desktop and mobile widths.

## Review configuration

- URL: `http://maker:4000/`
- Review password: `review-bookmarks`
- Launcher: `/work/.harness/app.json`
- The production fallback password is disabled when `NODE_ENV=production`; deployments must provide `BOOKMARKS_PASSWORD_HASH`.
