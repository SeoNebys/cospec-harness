# Keep — private bookmark library

Keep is a same-origin bookmark manager for private accounts. Paste an HTTP(S) address and it captures the page title and a validated site icon when possible; blocked, private, slow, or unreadable pages still save immediately with a readable fallback title and the built-in generic icon.

## Run locally

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run seed:review
npm run build
npm start
```

The server listens on `0.0.0.0:4000`. In the review environment, open `http://maker:4000`.

The prepared review account is:

- Email: `review@example.test`
- Password: `bookmark-review-password`

Review seeding is explicit, idempotent, and refused in production. Replace `AUTH_SECRET`, configure SMTP, use an HTTPS public origin, and disable review seeding before production deployment.

## Commands

- `npm run dev` — Vite client and Fastify server in watch mode
- `npm run build` — strict client/server type checks and production client build
- `npm test` — unit, component, integration, contract, security, and scale checks
- `npm run test:e2e` — desktop and mobile Chromium journeys
- `npm run lint` — TypeScript/React linting
- `npm run db:migrate` — checked-in SQLite migrations
- `npm run db:rebuild-search` — rebuild the FTS5 search projection

## Security boundary

All bookmark, folder, tag, search, metadata, and icon reads are scoped from the authenticated database session; the API never accepts a user ID from the browser. Mutations require JSON, the app header, an exact trusted origin, and non-cross-site Fetch Metadata. Remote metadata requests accept only public HTTP(S) destinations on default ports, revalidate every redirect and connected peer, enforce strict byte/time limits, send no cookies or credentials, and store only signature-validated raster icons.

SQLite runs with foreign keys, WAL, and a five-second busy timeout. Runtime data, secrets, reports, and build output are ignored; migrations and public assets are retained.
