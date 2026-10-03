# Keepwell Bookmark Manager

Keepwell is a private, responsive bookmark library. It captures editable page metadata, stores formatted notes, keeps independent Read Later and Favorites views, organizes primarily with reusable tags plus optional collections, archives reversibly, supports precise Boolean/phrase/tag search, saves live searches, and applies bulk actions to explicit selections or every current match.

## Commands

```bash
npm ci
npm run db:migrate
npm run db:seed:review
npm run dev
npm run build
npm start
npm test
npm run test:performance
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e
```

The production build is a single Fastify process serving the API and React client on `0.0.0.0:4000`. See `specs/001-bookmark-manager/quickstart.md` for acceptance scenarios and review credentials.
