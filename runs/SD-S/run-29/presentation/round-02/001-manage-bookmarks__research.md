# Research: Bookmark Manager

## Full-stack application

**Decision**: Use a Next.js 16 App Router monolith with TypeScript on Node.js 24.

**Rationale**: One application can render the responsive UI, enforce authorization near data access, and expose HTTP handlers without a separate frontend/backend deployment. Next.js supports a full-featured Node server or container and the workspace already provides Node 24.

**Alternatives considered**: A separate React SPA and API would duplicate routing, validation, auth, and deployment work. A static-only client cannot safely provide private shared persistence.

**Sources**: [Next.js App Router](https://nextjs.org/docs/app), [installation requirements](https://nextjs.org/docs/app/getting-started/installation), [deployment](https://nextjs.org/docs/app/getting-started/deploying)

## Database and data access

**Decision**: Use PostgreSQL 18 with Prisma ORM 7 and reviewed migrations. Use compound unique constraints and `pg_trgm` GIN indexes for owner-scoped partial search.

**Rationale**: PostgreSQL handles concurrent multi-user writes, durable uniqueness, transactions, pagination, and indexed case-insensitive partial matching at the specified scale. Prisma 7 is fully supported and avoids adopting the Prisma 8 release candidate during MVP development.

**Alternatives considered**: SQLite is simpler locally but constrains replicated or concurrent production deployment. Elasticsearch and a cache add synchronization and operations work that 10,000 bookmarks per user does not justify.

**Sources**: [Prisma PostgreSQL quickstart](https://www.prisma.io/docs/prisma-orm/quickstart/postgresql), [migration deployment](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-migrations-from-a-local-environment), [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html), [`pg_trgm`](https://www.postgresql.org/docs/18/pgtrgm.html)

## Authentication and authorization

**Decision**: Use Better Auth email/password authentication with database-backed sessions and a server-only data-access layer that derives user identity from the session for every query.

**Rationale**: A maintained library reduces the risk of bespoke password and session code. Database sessions support revocation. Centralized secure authorization prevents accidental cross-user access; owned-resource misses return 404 to avoid leaking existence.

**Alternatives considered**: Custom authentication has unnecessary security risk. JWTs in browser storage weaken revocation and increase token exposure. OAuth-only login adds provider setup not requested by the client.

**Sources**: [Better Auth database](https://better-auth.com/docs/concepts/database), [session management](https://better-auth.com/docs/concepts/session-management), [Next.js authentication and DAL guidance](https://nextjs.org/docs/app/guides/authentication), [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

## URL and tag normalization

**Decision**: Parse trimmed input with the platform WHATWG `URL`; accept only `http:` and `https:`, require a hostname, and reject embedded credentials. Use serialized `href` as the duplicate key while preserving meaningful path case, trailing slash, query order/content, and fragments. Normalize tag comparison keys using Unicode normalization, trimmed/collapsed whitespace, and locale-independent case folding.

**Rationale**: The parser safely normalizes unambiguous equivalents such as host case and default ports without changing destinations that the approved spec considers meaningful. Database uniqueness makes create/edit races safe.

**Alternatives considered**: Removing `www`, tracking parameters, fragments, or trailing slashes could merge distinct destinations. Raw-string equality would miss obvious duplicates.

**Sources**: [Node WHATWG URL API](https://nodejs.org/api/url.html), [WHATWG URL Standard](https://url.spec.whatwg.org/), [PostgreSQL unique indexes](https://www.postgresql.org/docs/current/indexes-unique.html)

## Validation limits and atomicity

**Decision**: Title: 1–200 characters after trim/collapse; URL: at most 2,048 characters after trim; tag: 1–50 characters after trim/collapse; at most 20 distinct tags per bookmark. Use one server-authoritative Zod schema and transactions for bookmark/tag writes.

**Rationale**: Explicit limits make validation testable, prevent accidental abuse, and cover ordinary web content. Shared schemas prevent create/edit drift; transactions preserve the last consistent state.

**Alternatives considered**: Unlimited input is unnecessary and risky. Client-only validation is bypassable. Optimistic mutations complicate exact rollback for little benefit.

**Source**: [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

## Accessible interaction

**Decision**: Prefer native semantic controls and landmarks, visible focus, logical DOM order, labelled/associated errors, a polite status region, and an accessible modal delete confirmation with contained/restored focus.

**Rationale**: Native behavior minimizes custom keyboard logic while meeting the approved keyboard-only requirement. Focus management makes destructive and dynamic actions perceivable.

**Alternatives considered**: A custom component suite is unnecessary for the MVP and can obscure semantics. Automated accessibility scans alone do not prove keyboard journeys.

**Sources**: [WAI-ARIA keyboard practice](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [WCAG focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)

## Testing strategy

**Decision**: Use Vitest and Testing Library for domain/components, real-PostgreSQL integration and contract tests, and Playwright 1.61.0 plus axe for browser acceptance. Add a seeded 10,000-record performance scenario.

**Rationale**: Each layer targets a distinct risk: normalization, database constraints/ownership, stable HTTP behavior, real keyboard/focus flows, and the measurable search target. Playwright is pinned to the browser revision available in the runtime image.

**Alternatives considered**: Browser-only tests would be slow and make race/constraint failures difficult to isolate. Unit tests alone cannot prove persistence, isolation, focus, or end-to-end timing.

**Sources**: [Testing Library queries](https://testing-library.com/docs/queries/about/), [Playwright accessibility](https://playwright.dev/docs/accessibility-testing), [keyboard input](https://playwright.dev/docs/input), [locators](https://playwright.dev/docs/locators)

## Deferred automatic title retrieval

**Decision**: Do not fetch page metadata in the MVP. Preserve an extension point after URL validation for a future server-side metadata service.

**Rationale**: Automatic titles are a requested near-term convenience, but server-side fetching creates SSRF, redirect, response-size, content-type, timeout, and hostile-markup risks requiring explicit requirements and tests.

**Alternatives considered**: Browser fetching is unreliable because of cross-origin restrictions; silently adding server fetching would violate the approved MVP scope.

**Source**: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
