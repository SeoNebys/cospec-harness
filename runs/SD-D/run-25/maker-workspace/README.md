# Safekeep

Safekeep is a private bookmark manager with automatic page details, tags, advanced search, a read-later queue, Markdown notes, bulk actions, and reversible archiving.

## Local setup

1. Copy `.env.example` to `.env.local` and provide a secret of at least 32 characters.
2. Run `npm ci`, `npm run db:migrate`, and `npm run seed:review`.
3. Run `npm run build` followed by `npm start`.

The server listens on `0.0.0.0:4000`. The seeded review account is `review@example.com` with password `Review-password-2026!`; it is development/review data only.

Quality commands: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e`.

Import/export is intentionally reserved for a follow-on release. Sharing, folders, browser extensions, saved page previews, automatic categorization, and broken-link checking are out of scope.
