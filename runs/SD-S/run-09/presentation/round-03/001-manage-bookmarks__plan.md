# Implementation Plan: Personal Bookmark Manager

**Branch**: `001-manage-bookmarks` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-manage-bookmarks/spec.md`

## Summary

Build a responsive, private bookmark manager as a same-origin TypeScript web application. A React single-page interface lets users paste a URL, preview automatically captured title and site icon, save immediately even when capture fails, and organize, search, favorite, edit, or delete their bookmarks. A Fastify server owns authentication, authorization, bookmark operations, metadata retrieval, and static delivery. SQLite provides durable single-node storage. Better Auth supplies email/password registration, database sessions, sign-out, and password recovery. The metadata service applies strict SSRF controls, bounded network work, local icon persistence, fallback metadata, and title-source rules so late fetches never overwrite a user's edit.

## Technical Context

**Language/Version**: Node.js 24 LTS; TypeScript 7.0.x; browser code targeting Vite's modern baseline

**Primary Dependencies**: React 19.3, Vite 8.3, Fastify 5.12, Better Auth 1.7, Drizzle ORM 0.45, `better-sqlite3` 13, Zod 4, Cheerio 1.2, Nodemailer 7, `@fastify/static` 10.1.2 or later, `@fastify/helmet`, `@fastify/cookie`, and `@fastify/rate-limit`

**Storage**: SQLite on local persistent disk in WAL mode; Drizzle schema and checked-in migrations; content-addressed site-icon blobs in SQLite; SMTP is an external production dependency for password-recovery delivery

**Testing**: Vitest 5 for unit/component/integration tests, React Testing Library with jsdom, Fastify `inject()` for HTTP integration, temporary real SQLite files for repository tests, and `@playwright/test` pinned to 1.61.0 for browser journeys

**Target Platform**: A single Linux-hosted Node.js process; responsive modern desktop and mobile browsers; final review server listens on `0.0.0.0:4000`

**Project Type**: Same-origin web application with a React SPA, JSON API, and server-managed sessions

**Performance Goals**: Save by URL in under 15 seconds; metadata visible within 5 seconds for at least 95% of eligible responsive pages; 95% of library interactions visibly complete within 2 seconds at 10,000 bookmarks; known bookmarks found and opened within 15 seconds

**Constraints**: Bookmark creation must succeed with fallback metadata when retrieval fails; metadata retrieval must not access non-public networks; a user edit must win over late metadata; all data access is scoped by authenticated user; no permissive cross-origin API; SQLite file must remain on local storage; review environment uses HTTP while production cookies require HTTPS

**Scale/Scope**: Individual private accounts, at least 10,000 bookmarks per user, one folder per bookmark, many tags per bookmark, cursor-paginated lists, one application node for v1, no collaboration/import/export/offline/browser extension

## Constitution Check

_GATE: Passed before research and re-checked after design._

The project constitution is still an unratified placeholder and imposes no additional technical rules. The workspace's enforceable Spec-Driven Development gate is satisfied: the specification was approved before this plan was produced. This plan creates design artifacts only; no application code or task list is included.

Post-design re-check: the architecture and contracts remain within the approved specification. No scope was added, no constitutional violation exists, and no complexity exception is required.

## Architecture

### Request and runtime flow

1. Fastify serves the production React build and all `/api/*` routes from one origin.
2. Better Auth handles `/api/auth/*`, uses the shared SQLite database, and sets an HTTP-only host cookie. Application routes resolve the current session once and never accept a client-supplied user ID.
3. The React client reads and mutates bookmark data through the documented JSON contract. Unsafe application requests require JSON, an app-specific header, same-origin checks, and a non-cross-site Fetch Metadata context.
4. Drizzle repositories require an authenticated user ID and include it in every lookup, mutation, join, and search. Database constraints reinforce same-user folder and tag relationships.
5. Entering a valid URL starts a debounced metadata preview. The server returns captured or fallback title/icon data plus a short-lived signed receipt. Saving can proceed before preview completion.
6. A save without a usable receipt persists a fallback title and generic icon immediately, then schedules one bounded in-process metadata attempt. A conditional update replaces only fallback metadata; it never replaces a title whose source is `user`.
7. A successful favicon fetch is validated, stored as a content-addressed blob, and served only through an authorized bookmark-icon route with defensive content headers. The browser never hotlinks a remote icon.

### Authentication and account recovery

- Better Auth email/password flows provide registration, sign-in, sign-out, database sessions, password-reset tokens, origin/CSRF protections, and database-backed rate limiting.
- Passwords use the library's non-blocking scrypt support. Passwords are 15–128 characters; no composition rules are imposed.
- Sessions expire after seven days with a one-day rolling refresh. Cookie caching stays disabled so revocation is immediately effective.
- Production cookies are `Secure`, `HttpOnly`, host-only, `SameSite=Lax`, and path `/`. Review/development permits a non-secure cookie only because the harness endpoint is HTTP.
- Password-reset requests always return the same response. Tokens are hashed, single-use, expire after one hour, and revoke existing sessions after a successful reset.
- Nodemailer uses configured SMTP in production. Tests inject an in-memory mailer; local development may use an explicit console transport that must never be enabled in production.

### Metadata safety policy

- Parse with the WHATWG URL implementation. Only `http:` and `https:` bookmarks are valid. Embedded credentials are rejected. Fragments are retained in the bookmark but excluded from the network request.
- Metadata retrieval is eligible only for public hosts on default ports. Ineligible URLs remain valid bookmarks with fallback metadata.
- Resolve IPv4 and IPv6 under a bounded deadline. Reject the hop if any result is loopback, private, link-local, unspecified, carrier-grade NAT, documentation, benchmark, multicast, reserved, unique-local IPv6, IPv4-mapped non-public IPv6, or another IANA special-purpose address.
- Pin the selected validated address into the actual HTTP/TLS connection, keep the original hostname for Host/SNI validation, and confirm the connected remote address. Do not resolve once and then call an ordinary unpinned fetch.
- Follow at most five redirects manually. Reapply scheme, port, DNS, address, and connection checks to every document and icon hop. Reject redirect cycles and HTTPS-to-HTTP downgrades.
- Use GET without credentials or cookies, strict TLS validation, no retries, `Connection: close`, a 16 KiB header limit, a 1 MiB streamed HTML limit, a 256 KiB icon limit, and a 4.5-second overall deadline. Accept HTML/XHTML only and identity encoding in v1.
- Parse inert HTML without script execution. Prefer a non-empty document title, then `og:title`, then `twitter:title`, then a readable hostname fallback. Normalize whitespace and control characters, cap titles at 300 Unicode code points, and always render them as text.
- Accept only validated PNG, JPEG, GIF, WebP, or ICO bytes. Reject SVG. A built-in generic icon is always available.
- Limit preview attempts per user and globally cap concurrent outbound fetches. Log only coarse failure categories and avoid full URLs or query strings.

### Search and pagination

- A transactional SQLite FTS5 table uses the trigram tokenizer for case-insensitive substring search across title, URL, and aggregated tag names.
- Search rows are refreshed in the same transaction as bookmark/title/address/tag changes; tag rename or removal refreshes all affected rows.
- Queries shorter than three characters use a user-scoped escaped `LIKE` scan. At the required 10,000-row scale this remains bounded and is verified by the performance fixture.
- Lists use stable cursor pagination with an ID tie-breaker. Indexed paths cover newest, oldest, title, folder, favorite, duplicate-address, and tag filters.

### Error and concurrency behavior

- Expected validation errors use stable machine-readable codes and specific field messages. Unexpected failures use a generic response plus a server request ID.
- Create/edit forms keep user input after a failed mutation. Optimistic favorite changes roll back on failure.
- Metadata results use compare-and-set semantics against the current title source. A user edit changes the source to `user` atomically, so a late fetch cannot overwrite it.
- Deleting a folder transactionally clears bookmark folder associations before removal. Deleting a tag removes associations but retains bookmarks. Deleting a bookmark removes tag associations while shared icon bytes are garbage-collected only when unreferenced.

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-bookmarks/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── ui-states.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # Created only after plan approval
```

### Source Code (repository root)

```text
src/
├── client/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   ├── bookmarks/
│   │   └── organization/
│   ├── lib/
│   ├── styles/
│   └── main.tsx
├── server/
│   ├── api/
│   ├── auth/
│   ├── db/
│   ├── mail/
│   ├── metadata/
│   ├── repositories/
│   ├── services/
│   ├── app.ts
│   └── index.ts
└── shared/
    ├── contracts/
    ├── errors/
    └── validation/

drizzle/
├── migrations/
└── schema/

public/
└── generic-site-icon.svg

scripts/
├── migrate.ts
├── rebuild-search.ts
└── seed-review.ts

tests/
├── contract/
├── integration/
├── unit/
├── component/
├── e2e/
└── fixtures/

data/                         # Runtime only; ignored by git
dist/                         # Build output; ignored by git
```

**Structure Decision**: Use one npm package and one production process. Client, server, and shared transport types stay in separate source areas, while Fastify serves both the compiled SPA and the API. This avoids a multi-service deployment while retaining explicit browser/server boundaries. Drizzle migrations cover Better Auth and application tables together.

## Verification Strategy

### Unit and component coverage

- URL validation, normalization, duplicate keys, title fallback, title-source race rules, cursors, query parsing, and folder/tag name normalization.
- Metadata parser and fetch policy with injected DNS, sockets, clocks, and response streams; cover unusual IP representations, mixed DNS results, rebinding, redirects, size/time limits, charset handling, active icons, and malformed pages.
- Authentication and library components for initial, loading, empty, error, duplicate, fallback, metadata-ready, filtering, and deletion-confirmation states.

### Integration and contract coverage

- Run real migrations against isolated temporary SQLite files with foreign keys and WAL settings enabled.
- Validate OpenAPI response shapes and stable error codes through Fastify `inject()`.
- Exercise registration, sign-in/out, generic recovery responses, reset expiry/single use, session revocation, cookie flags, rate limits, origin rejection, and missing app headers.
- Run a two-user authorization matrix across every list, get, create, update, delete, favorite, folder, tag, search, metadata, and icon route.
- Seed 10,000 bookmarks and verify search/filter/sort combinations, cursor stability, duplicate detection, FTS consistency, and the two-second interaction target.

### Browser coverage

- Register and sign in; save by URL with automatic title/icon; edit the captured title before and after save; reopen it in a new session.
- Save when metadata is blocked or unavailable and confirm fallback behavior.
- Exercise duplicate warning choices, combined search/filter/sort, folders, tags, favorites, edit, delete cancellation/confirmation, empty results, sign-out, and recovery UI.
- Run desktop and mobile-sized Chromium checks against the production build with Playwright 1.61.0 and confirm `data-harness-ready="true"` only after the valid initial state loads.

## Runtime and Delivery

- `npm run build` produces the SPA and compiled server before review.
- `npm start` runs the foreground server on `0.0.0.0:4000`; the app is reviewed at `http://maker:4000` and automated browser checks use `http://127.0.0.1:4000`.
- The implementation phase writes `/work/.harness/app.json` with `{"kind":"application","port":4000,"path":"/","start_command":["npm","start"],"start_cwd":"/work"}` after dependencies, migrations, seed data, and build are ready.
- Runtime state defaults below `/work/data`; the SQLite database and secrets are ignored by git. A seeded development-only review account is created by `npm run seed:review` using explicit environment values.

## Complexity Tracking

No constitution violations or exceptional structures require justification. Better Auth and Drizzle add dependencies, but replace security-sensitive custom authentication and unify auth/application migrations; the application still deploys as one process with one database.
