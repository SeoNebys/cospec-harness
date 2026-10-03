# Latch Bookmark Manager

Latch is a private, responsive bookmark library with automatic page details, read-later status, archive/restore, advanced search, formatted notes, bulk actions, and live saved views.

## Run locally

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed:review
npm run build
npm start
```

Open `http://maker:4000/` from the review environment. The local review defaults are `review@example.test` / `bookmark-review`; override both through environment variables outside review. Production must provide a strong `SESSION_KEY`, provision users independently, terminate TLS appropriately, and back up the SQLite database.

## Validate

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
```

Metadata retrieval accepts only public HTTP(S) destinations, validates every DNS result and redirect, pins the approved address, and limits duration and response size. Deployment-level outbound filtering is recommended as defense in depth.

The media cache contains only bounded publisher icons and preview images and can be evicted. Latch does not save page HTML, article text, scripts, or full offline page copies; that remains a possible later feature.
