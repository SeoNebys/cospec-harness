# Kept

A private, keyboard-accessible bookmark library for saving, tagging, searching, editing, and safely deleting links.

## Run locally

Copy `.env.example` to `.env.local`, set a long random `BETTER_AUTH_SECRET`, then:

```bash
npm ci
npm run db:migrate
npm run dev
```

Open `http://maker:4000`. The self-contained review build stores data under `data/`; production deployments should use managed PostgreSQL with backups and point-in-time recovery.
Set `AUTH_SECURE_COOKIES=true` behind production HTTPS; it remains false only for the HTTP review environment.

## Quality checks

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build`.

## Deferred follow-up

Automatic page-title lookup is the next requested feature. It is deliberately absent from this MVP because server-side URL fetching needs a separate SSRF-safe design covering private-network blocking, redirects, timeouts, byte limits, content types, and user override behavior.
