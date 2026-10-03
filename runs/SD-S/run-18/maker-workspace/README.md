# Keepsake bookmark manager

Keepsake is a private, owner-scoped bookmark library. Paste an HTTP(S) address and the server safely retrieves its title and page description when available; unreachable or prohibited destinations receive a readable fallback title so saving is never blocked. Bookmarks support tags, search, exact tag filtering, editing, and confirmed permanent deletion.

## Local and review setup

Requirements: Node.js 24, npm, and a writable directory for SQLite.

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run seed:review
npm run dev
```

The server listens on `0.0.0.0:4000`. Open `http://maker:4000/` in the shared review environment. Review credentials are shown on the development sign-in page; runtime sign-up is disabled.

The review harness uses `npm run start:review`, which supplies development-only review settings. Production deployments must use `npm start` with their own environment variables.

## Verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run test:contract
npm run test:performance
npm run build
npm run test:e2e
```

`npm run verify` runs the complete sequence. Migrations are explicit and idempotent; `npm start` only starts an already prepared build.

## Production notes

- Set `NODE_ENV=production`, `REVIEW_MODE=0`, a fresh high-entropy `BETTER_AUTH_SECRET`, one exact HTTPS `BETTER_AUTH_URL`, and matching trusted origin.
- Put `DATABASE_PATH` on durable storage, back it up, and run `npm run db:migrate` before each release.
- Allow controlled outbound DNS and HTTP(S) egress for metadata retrieval while denying private/special networks at infrastructure level. Application checks also resolve every address, pin the approved DNS result, verify the connected peer, constrain redirects, and bound time/body/header sizes.
- Cookies are HttpOnly, SameSite=Lax, and secure in production. Never expose review credentials in production.

The complete acceptance procedure and security assumptions are in [the quickstart guide](specs/001-bookmark-manager/quickstart.md).
