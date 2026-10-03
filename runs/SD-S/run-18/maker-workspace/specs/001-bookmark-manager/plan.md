# Implementation Plan: Bookmark Manager

**Branch**: `[001-bookmark-manager]` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

Build a responsive, authenticated bookmark manager as one server-rendered TypeScript application. Users paste a web address; a server-only inspection service validates the destination, safely retrieves bounded page metadata, and returns an editable title and optional description or a deterministic fallback. Bookmarks and case-insensitive tags are stored in SQLite with owner-scoped constraints. Search, filtering, editing, deletion, duplicate handling, and all mutations run through owner-scoped services. The app ships with unit, component, database integration, contract, security, and browser journey tests.

## Technical Context

**Language/Version**: TypeScript 5.9.x on Node.js 24 LTS, ESM

**Primary Dependencies**: React Router 8.4 Framework Mode, React 19.3, Better Auth 1.7, Drizzle ORM 0.45, `better-sqlite3` 13, Zod 4, Cheerio 1.2

**Storage**: SQLite with committed Drizzle SQL migrations; one persistent database file for auth, bookmarks, tags, and sessions

**Testing**: Vitest 5, React Testing Library, contract tests against route handlers, and Playwright 1.61.0 for browser journeys

**Target Platform**: Linux-hosted Node.js web server; responsive support for current Chrome, Edge, Firefox, and Safari releases

**Project Type**: Single full-stack web application with server-rendered routes and resource endpoints

**Performance Goals**: A first bookmark can be saved without typing a title in under 30 seconds; metadata resolves or falls back within 3 seconds; library and search views for 1,000 bookmarks become usable within 2 seconds for at least 95% of normal attempts

**Constraints**: Listen on `0.0.0.0:4000`; authenticated owner isolation on every data path; metadata retrieval limited to public HTTP(S) destinations on ports 80/443, a 2.5-second total deadline, three redirects, 16 KiB response headers, and 512 KiB streamed response content; no client-side arbitrary-site fetching; no external database or hosted identity dependency for v1

**Scale/Scope**: Individual private libraries with at least 1,000 bookmarks per user; initial single application instance; four main screens/states (sign-in, library, bookmark editor, confirmation/empty states) and five domain resource operations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

The project constitution is still an unratified placeholder and defines no enforceable project-specific principles. The repository-level Spec-Driven Development rules therefore supply the active gates.

| Gate | Pre-research result | Post-design result |
|------|---------------------|--------------------|
| Approved specification exists before planning | PASS — client approved `spec.md` on 2026-09-24 | PASS |
| Plan remains traceable to approved scope | PASS — all 22 functional requirements are represented | PASS — contracts, data model, and validation guide preserve scope boundaries |
| No implementation begins during planning | PASS | PASS — only planning artifacts were created |
| Private user data is isolated | PASS — owner-scoped services and persistence required | PASS — database constraints, opaque sessions, 401/404 behavior, and two-user tests are specified |
| Arbitrary URL retrieval is safely bounded | PASS — dedicated security research required | PASS — validation, address pinning, redirect revalidation, resource limits, and network-policy defense are specified |
| Complexity is proportionate to v1 | PASS — one application and one local relational store | PASS — no separate frontend/backend deployment or external service introduced |

No gate violations require exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                 # Created only after plan approval
```

### Source Code (repository root)

```text
app/
├── auth/
│   ├── auth.server.ts
│   ├── require-user.server.ts
│   └── review-seed.server.ts
├── components/
│   ├── bookmark-card.tsx
│   ├── bookmark-editor.tsx
│   ├── bookmark-list.tsx
│   ├── filter-bar.tsx
│   ├── tag-input.tsx
│   └── ui/
├── db/
│   ├── client.server.ts
│   ├── migrate.server.ts
│   └── schema.ts
├── features/
│   └── bookmarks/
│       ├── bookmark.repository.server.ts
│       ├── bookmark.service.server.ts
│       ├── bookmark.validation.ts
│       ├── tag.repository.server.ts
│       └── url-normalization.ts
├── routes/
│   ├── _auth.login.tsx
│   ├── _library._index.tsx
│   ├── api.auth.$.ts
│   ├── api.bookmarks.$bookmarkId.ts
│   ├── api.bookmarks.ts
│   ├── api.metadata.preview.ts
│   └── api.tags.ts
├── services/
│   └── metadata/
│       ├── address-policy.server.ts
│       ├── fetch-page.server.ts
│       ├── metadata-parser.server.ts
│       └── metadata.service.server.ts
├── styles/
│   └── app.css
├── root.tsx
└── routes.ts

drizzle/
├── migrations/
└── meta/

scripts/
└── seed-review-users.ts

tests/
├── contract/
├── e2e/
├── fixtures/
├── integration/
├── security/
└── unit/

data/                         # Runtime SQLite file; ignored by version control
public/
.env.example
drizzle.config.ts
playwright.config.ts
react-router.config.ts
tsconfig.json
vite.config.ts
vitest.config.ts
package.json
package-lock.json
```

**Structure Decision**: Use one React Router Framework Mode application so the UI, loaders/actions, authentication boundary, and resource routes share one type system and one deployable server. Business rules live below routes in feature services and repositories; arbitrary-page retrieval is isolated under `app/services/metadata` so it can be adversarially tested without involving UI code. SQLite migrations and all test layers remain top-level, explicit artifacts.

## Architecture and Request Flow

1. An unauthenticated request is redirected to the sign-in screen. Better Auth resolves an opaque, database-backed session cookie on the server.
2. The library loader obtains the authenticated user ID and calls only repositories whose public operations require that ID.
3. When a user pastes a URL, the editor debounces a `POST /api/metadata/preview` request. The endpoint normalizes the URL, checks for an owner-scoped duplicate, then invokes the metadata service.
4. The metadata service accepts only public HTTP(S) destinations. It resolves and classifies every address, pins the approved address during connection, manually revalidates redirects, streams a bounded HTML response, and parses inert metadata without executing page content.
5. The preview returns `retrieved`, `fallback`, or validation/duplicate information. The editor applies returned values only to fields the user has not modified since the request began.
6. Create and update requests are validated again on the server. Bookmark and tag changes run in a single transaction, with database constraints resolving races.
7. Search and tag filters are owner-scoped at query time. Foreign or nonexistent resource IDs return the same `404` response; missing sessions return `401`.

## Security and Privacy Design

- Do not accept an owner ID from clients. Derive it from the server session for every loader, action, and resource endpoint.
- Store only opaque session identifiers in `HttpOnly`, `SameSite=Lax` cookies. Production requires HTTPS, secure cookies, a high-entropy secret, and an exact trusted-origin allowlist.
- Keep review-mode HTTP origins and seeded identities in a separate, non-production configuration. The seeding command refuses to run in production.
- Normalize URLs with the WHATWG URL parser; reject credentials and unsupported schemes. Bookmark URLs using nonstandard ports may be stored with fallback metadata but are never inspected.
- Reject a metadata hop if any resolved address is loopback, private, link-local, multicast, unspecified, reserved, or otherwise non-public, including IPv4-mapped IPv6 and translation/tunneling ranges.
- Pin the validated DNS result into the connection, verify the connected peer, disable socket reuse across hops, and repeat all checks after each redirect.
- Send no cookies, authorization, referrer, proxy-derived credentials, or user-controlled request headers to inspected pages.
- Parse at most 512 KiB of HTML as inert data. Never execute scripts, load subresources, or render fetched markup.
- Apply per-user and per-host concurrency/rate limits. Production deployment should additionally deny private/control-plane egress at the network layer.
- Render all fetched titles and descriptions as text, normalize whitespace and Unicode, remove control/bidirectional formatting characters, and enforce length limits.

## Data and Transaction Design

- Better Auth owns `user`, `session`, `account`, and `verification` tables through its Drizzle adapter.
- Domain tables are `bookmarks`, `tags`, and `bookmark_tags`; their detailed fields and invariants are defined in [data-model.md](./data-model.md).
- `UNIQUE(owner_id, normalized_url)` makes duplicate prevention atomic per user while allowing two different users to save the same URL.
- `UNIQUE(owner_id, normalized_name)` makes tags case-insensitively unique per user.
- Composite ownership keys on tag associations prevent cross-user bookmark/tag links at the database layer.
- Create/update operations upsert tags and replace associations in one transaction. A uniqueness race maps to the documented duplicate response.
- Enable foreign keys, a bounded busy timeout, and WAL mode for the single-process deployment. Run committed migrations before server startup, never schema-push in production.

## Interface and Interaction Design

- The HTTP resource contract is defined in [contracts/openapi.yaml](./contracts/openapi.yaml).
- The primary library view contains the quick-save URL entry, metadata status, editable title/description, optional tags, search, active filters, and newest-first bookmark list.
- Pending metadata retrieval is announced without locking edited fields. An outdated response is ignored if the URL changes; late data never overwrites user edits.
- Validation and operation results use visible inline messages plus an accessible status region. Keyboard focus moves to the first invalid field or the relevant confirmation/result.
- Deletion requires a confirmation dialog. Cancel leaves the item unchanged; success removes it and announces the result.
- Empty-library and no-match states are distinct and each offers the relevant recovery action.
- The responsive layout targets keyboard and touch use, honors reduced-motion preferences, and is verified against WCAG 2.2 AA automated checks plus keyboard journeys.

## Verification Strategy

- **Unit**: URL and tag normalization, fallback-title generation, private/special IP classification, metadata sanitization/priority, validation bounds, and search predicates.
- **Component**: editor loading/resolved/fallback/invalid states, dirty-field protection from late previews, tag input, filters, result messages, and delete confirmation.
- **Integration**: real migrations on fresh temporary SQLite databases; owner-scoped CRUD/search/filter operations; transactional tag replacement; duplicate races; session revocation.
- **Security**: alternative IPv4 forms, IPv6 and mapped addresses, mixed DNS answers, rebinding attempts, connected-peer mismatch, redirect pivots/downgrades/loops, timeouts, oversized headers/bodies, compressed/non-HTML responses, and inert parsing.
- **Contract**: validate route status codes and response bodies against `contracts/openapi.yaml`, including `401`, owner-obscuring `404`, `409`, `422`, and fallback preview results.
- **End-to-end**: sign-in; automatic title/description; fallback save; reopen; tag; search/filter/reset; edit; duplicate handling; confirm/cancel delete; empty states. A two-browser-context test proves cross-user isolation through both UI and direct requests.
- **Performance**: seeded 1,000-bookmark library verifies the 2-second library/search target; a controlled metadata fixture verifies the 3-second preview target without depending on the public internet.

## Delivery and Operations

- `npm run build` creates the prepared production build. `npm start` runs the server with `HOST=0.0.0.0` and `PORT=4000` defaults.
- A separate `npm run db:migrate` step applies committed migrations before start.
- `npm run seed:review` creates two review-only accounts idempotently and refuses a production environment.
- Runtime data lives under `data/`; secrets and database files are excluded from version control.
- Structured logs record request IDs and safe metadata failure categories but never session tokens, passwords, resolved internal addresses, or full URLs containing query secrets.
- When implementation is ready, `.harness/app.json` will declare the production start command and port 4000; the UI will expose `data-harness-ready="true"` only after the authenticated or valid sign-in state has loaded.

## Complexity Tracking

No constitution violations or exceptional complexity require justification. A single app, one relational store, and one isolated metadata service are the minimum architecture that satisfies private multi-user data and safe server-side page inspection.
