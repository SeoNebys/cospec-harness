# Implementation Plan: Bookmark Manager

**Branch**: `001-manage-bookmarks` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-manage-bookmarks/spec.md`

## Summary

Build a responsive, private bookmark manager as one server-rendered web application. Users create an account, save validated links, organize them with tags, search/filter a paginated collection, edit details, and delete only after confirmation. A Next.js/TypeScript application will expose typed route handlers and render the UI; PostgreSQL will enforce ownership and uniqueness; Better Auth will provide email/password authentication with database-backed sessions. Shared domain validation, transactional writes, semantic HTML, and layered automated tests protect correctness and keyboard accessibility.

Automatic page-title retrieval is intentionally excluded from this MVP. The URL model and save flow leave room for a later server-side metadata service, which must receive a separate SSRF-focused specification and plan.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 LTS

**Primary Dependencies**: Next.js 16 with React and App Router; Better Auth for email/password authentication and database-backed sessions; Prisma ORM 7 for PostgreSQL access and migrations; Zod for shared input contracts; CSS Modules for styling

**Storage**: PostgreSQL 18 with `pg_trgm`; managed production database and isolated local/test databases

**Testing**: Vitest with Testing Library and `user-event`; PostgreSQL integration tests; Playwright 1.61.0 with `@axe-core/playwright`; ESLint and TypeScript checks

**Target Platform**: Modern browsers supported by Next.js 16; Linux-hosted Node.js server or container listening on `0.0.0.0:4000`

**Project Type**: Full-stack responsive web application

**Performance Goals**: With 10,000 bookmarks for one user, 95% of search or tag-filter actions display results within 1 second; collection queries return at most 50 records per page; ordinary mutations provide visible confirmation within 1 second under normal conditions

**Constraints**: Private data must never cross user boundaries; authenticated responses are not publicly cached; only `http` and `https` bookmark URLs are accepted; query strings and fragments remain significant for duplicate detection; all core journeys must work by keyboard; save/edit/delete operations are atomic

**Scale/Scope**: Individual-user collections up to 10,000 bookmarks, at most 20 tags per bookmark, one application service and one relational database; no sharing, import/export, folders, extensions, offline mode, or automatic metadata retrieval in MVP

## Constitution Check

*GATE: Passed before research and again after Phase 1 design.*

The constitution file contains only an unratified template and therefore defines no enforceable project principles. The repository's governing SDD instructions are satisfied: the specification is approved, this plan is produced before tasks or implementation, and no application code is created in this phase.

Additional design gates:

- **Scope discipline — PASS**: Every component maps to an approved requirement; automatic title retrieval remains deferred.
- **Privacy — PASS**: Session-derived ownership is mandatory in the data-access layer and database constraints.
- **Accessibility — PASS**: Native semantics, focus behavior, live feedback, and keyboard acceptance tests are designed in.
- **Simplicity — PASS**: One deployable application and one database; no separate API service, cache, queue, or search engine.
- **Verifiability — PASS**: Unit, integration, contract, browser, accessibility, and performance checks cover the specification outcomes.

## Design Decisions

### Application boundaries

- App Router pages and layouts render authentication and bookmark screens on the server; small client components manage interactive forms, filters, focus, and confirmation dialogs.
- Route Handlers under `/api` implement the contract in `contracts/openapi.yaml`. UI code uses the same endpoints, keeping browser tests and behavior aligned.
- A server-only data-access layer resolves the authenticated user and scopes every bookmark/tag read or mutation. Resource identifiers from clients never determine ownership.
- Domain modules own URL normalization, tag normalization, field limits, and typed errors so create and edit behavior cannot drift.

### Persistence and querying

- PostgreSQL stores users/sessions through Better Auth and application-owned Bookmark, Tag, and BookmarkTag records described in `data-model.md`.
- Database constraints are the final authority for owner-scoped normalized URL and tag uniqueness. Mutations involving tags run in transactions and convert uniqueness races into stable conflict responses.
- Collection reads use cursor pagination with a maximum page size of 50. Search is server-side, case-insensitive partial matching across title, URL, and tag name; tag filters are owner-scoped joins.
- B-tree ownership/sort/join indexes and GIN trigram search indexes support the 10,000-item target without a separate search service.

### Security and state integrity

- Better Auth supplies registration, login, logout, password hashing, secure cookies, session rotation, expiration, and revocation. Production cookies are host-only, `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- Private pages and endpoints send `Cache-Control: private, no-store`. Login errors are generic and authentication endpoints are rate limited by account and source.
- Server validation is authoritative. Client validation only shortens feedback time. Writes use pessimistic UI: preserve inputs on failure, disable only the submitting control, and refresh authoritative state after success.
- Error responses use stable categories: `400` malformed request, `401` unauthenticated, `404` absent/not-owned, `409` duplicate, `422` field validation, and `500` retryable server failure with a correlation identifier.

### Accessibility and interaction

- Use native links, buttons, inputs, labels, landmarks, and heading structure with visible `:focus-visible` treatment and no positive `tabindex`.
- Delete confirmation is a labelled modal dialog: focus enters on Cancel, Tab remains inside, Escape cancels, and focus returns to the invoker or the next logical bookmark after deletion.
- Field errors are associated with inputs; save/edit/delete and result-count changes use a persistent polite status region. The first invalid field receives focus after rejected submission.
- Search input is debounced by 250 ms, reflected in the URL, and paired with a clear control. Server results remain the source of truth.

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
│   └── openapi.yaml
└── tasks.md                 # Created only after plan approval
```

### Source Code (repository root)

```text
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── api/
│   ├── auth/[...all]/route.ts
│   ├── bookmarks/route.ts
│   ├── bookmarks/[id]/route.ts
│   └── tags/route.ts
├── bookmarks/page.tsx
├── layout.tsx
└── page.tsx
components/
├── auth/
├── bookmarks/
└── ui/
lib/
├── auth/
├── dal/
├── db/
├── domain/
└── validation/
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
public/
styles/
tests/
├── contract/
├── e2e/
├── integration/
├── performance/
└── unit/
```

**Structure Decision**: A single full-stack Next.js project keeps UI, authorization, contracts, and persistence in one deployable unit while maintaining explicit server-only domain and data-access boundaries. Tests are separated by confidence level so fast checks run before database and browser suites.

## Deployment and Operations

- Build once with locked dependencies, apply reviewed migrations as a release step, then run `npm start -- --hostname 0.0.0.0 --port 4000`.
- Store database URL, authentication secret, and trusted origin settings in environment secrets. Terminate TLS at the production ingress and use a pooled database connection.
- Emit structured server logs with correlation IDs and action/result categories; never log passwords, session tokens, or full bookmark URLs.
- Back up the managed PostgreSQL database and enable point-in-time recovery. Health checks verify process and database connectivity without exposing user data.
- The final repository will include `/work/.harness/app.json` only during implementation, after dependencies and a production build are ready.

## Post-Design Constitution Check

**PASS**. Phase 1 artifacts preserve all pre-research gates. The data model enforces privacy and duplicates, the API contract has stable validation/error semantics, and the quickstart proves primary, isolation, accessibility, and scale outcomes. No unjustified complexity or out-of-scope feature was introduced.

## Complexity Tracking

No constitution violations require justification.
