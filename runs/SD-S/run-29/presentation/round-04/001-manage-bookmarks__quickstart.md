# Validation Quickstart: Bookmark Manager

This guide defines the runnable evidence expected after implementation. Commands are planning targets and become executable during the implementation phase.

## Prerequisites

- Node.js 24 and npm
- PostgreSQL 18 with permission to create the `pg_trgm` extension
- Environment values for `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://maker:4000`, and the corresponding isolated test database
- Playwright browser revision compatible with `@playwright/test` 1.61.0 at `/opt/playwright-browsers`

## Prepare and run

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run build
npm start -- --hostname 0.0.0.0 --port 4000
```

Expected: `http://maker:4000` shows a ready login or bookmark screen, and the visible application root has `data-harness-ready="true"` only after its initial state is loaded.

## Automated gates

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e
npm run test:performance
```

Expected:

- Unit tests cover URL equivalence/non-equivalence, invalid schemes/credentials, title/tag normalization, and all limits.
- Integration tests use a real test database to prove transactions, duplicate races, tag reuse/cleanup, pagination, and cross-user isolation.
- Contract tests validate every operation and error shape in `contracts/openapi.yaml`.
- Browser tests cover registration/login/logout, create/open/search/filter/edit/delete, empty states, duplicate guidance, preserved input after failure, and reload persistence.
- Performance tests seed 10,000 bookmarks for one user and record at least 20 search/filter samples; at least 95% display results within 1 second.

## Manual keyboard and accessibility review

1. Register or log in without a mouse.
2. Save a valid URL and title, including tags, using Tab/Shift+Tab and Enter.
3. Confirm focus and a status announcement after save.
4. Search and select/clear a tag filter; confirm result counts and no-results recovery are announced.
5. Edit the bookmark and trigger an invalid submission; confirm the first invalid field receives focus and input is preserved.
6. Open Delete; confirm focus begins on Cancel, remains in the dialog, Escape cancels, and focus returns to Delete.
7. Reopen Delete and confirm it; verify focus moves logically and removal is announced.
8. Run the automated axe scan, then manually verify focus visibility, order, labels, errors, and zoom/reflow.

Expected: every approved primary journey completes by keyboard, focus is always perceivable, and dynamic results are conveyed without relying on vision alone.

## Privacy and failure review

1. Create two independent accounts and bookmark data under each.
2. While signed in as account B, attempt every known account-A bookmark identifier through list, read, edit, and delete requests.
3. Confirm no account-A data appears and owned-resource attempts return the same not-found behavior as nonexistent identifiers.
4. Force a database failure during create/edit/delete and confirm the previous state is intact, submitted form values remain available, and a retryable message with correlation ID appears.
5. Inspect private responses for `Cache-Control: private, no-store` and session cookies for host-only, `HttpOnly`, production `Secure`, `SameSite`, and path settings.

## Duplicate review

Save `HTTP://Example.com:80`, then attempt `http://example.com/`; expect one saved record and a `409` duplicate response pointing to the existing bookmark. Repeat concurrently to prove the database constraint, not a timing-sensitive pre-check, is authoritative. Confirm meaningful query order and fragment differences remain distinct as documented in `data-model.md`.
