# Implementation Plan: Personal Bookmark Manager

**Branch**: `001-manage-bookmarks` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `/specs/001-manage-bookmarks/spec.md`

## Summary

Build a responsive personal bookmark web application with a React/TypeScript client and a Node.js/Express service backed by SQLite. The service owns authentication, bookmark persistence, search/filtering, duplicate detection, and safe page-title retrieval. When a user pastes or finishes entering a valid URL while the title remains untouched and empty, the client automatically requests a title preview; the server fetches only public HTTP(S) pages under strict network, redirect, time, content-type, and response-size limits. A failed preview never blocks manual entry or saving.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.x; browser code targets current evergreen desktop and mobile browsers

**Primary Dependencies**: React, React DOM, Vite with its official React plugin, Express 5, Zod, htmlparser2; Node built-ins for SQLite, cryptography, DNS, HTTP, and URL handling

**Storage**: File-backed SQLite via `node:sqlite`, with migrations and foreign keys enabled; an in-memory database is used by automated service tests

**Testing**: Vitest for unit/integration tests, Supertest for HTTP contract tests, React Testing Library for component behavior, and Playwright 1.61.0 for end-to-end browser scenarios

**Target Platform**: Linux-hosted Node.js process listening on `0.0.0.0:4000`; responsive web client for modern browsers

**Project Type**: Single repository web application with a browser client, JSON HTTP service, and shared validation/contracts

**Performance Goals**: Search/filter results visible within 1 second for a 10,000-bookmark collection; normal bookmark mutations visible within 500 ms; title preview concludes successfully or falls back within 6 seconds

**Constraints**: Private per-user collections; only `http` and `https` destinations; page-title retrieval must resist SSRF and resource exhaustion; no fetched page content is persisted; user-entered form values survive validation, duplicate warnings, and preview failure; destructive deletion requires explicit confirmation

**Scale/Scope**: First release supports personal accounts, up to 10,000 bookmarks per user, 20 tags per bookmark, and four primary UI states: sign-in, active collection, archived collection, and bookmark create/edit dialog

## Constitution Check

_GATE: Evaluated before research and again after design._

The project constitution is still an unratified placeholder and defines no enforceable technical gates. The repository-level SDD governance does apply and is satisfied: the specification is approved, this plan precedes task generation and implementation, and no application code is created in this phase.

**Pre-research gate result**: PASS — no constitutional violations or unresolved technical clarifications.

**Post-design gate result**: PASS — research, data model, contracts, and validation guidance remain within the approved scope. No complexity exception is required.

## Architecture and Design Decisions

### Application boundaries

- The React client renders account access, collection views, search/filter controls, bookmark forms, confirmation dialogs, and accessible feedback.
- The Express service is the only component allowed to access SQLite or retrieve remote page titles.
- Shared TypeScript schemas define accepted input and response shapes, while the OpenAPI document is the reviewable service contract.
- A repository layer owns parameterized SQL and tenant scoping; domain services own URL normalization, duplicate policy, tag normalization, authentication, and title-preview safety.

### Automatic title flow

1. The URL field recognizes paste immediately and also checks on blur after typed input.
2. If the URL is valid and the title is still empty and has not been manually changed, the client debounces briefly and calls `POST /api/title-previews` automatically.
3. The UI shows a non-blocking “Finding title…” state and cancels or ignores stale requests when the URL changes.
4. A returned title fills the field as an editable suggestion. It never overwrites a title the user typed while the request was pending.
5. Timeout, blocked destination, non-HTML content, missing title, or network failure produces a concise fallback message and leaves the form ready for manual title entry and saving.

### Security boundaries

- Every bookmark and tag query includes the authenticated user's identifier; resource identifiers alone never authorize access.
- Passwords use asynchronous scrypt with a unique random salt. Sessions use random opaque tokens, store only token digests, expire server-side, and are delivered in `HttpOnly`, `SameSite=Lax` cookies; production cookies are `Secure`.
- State-changing requests require a same-origin `Origin` header check in addition to SameSite cookies. Login attempts and title-preview requests are rate limited.
- Title retrieval rejects credentials in URLs, non-HTTP(S) schemes, localhost names, and every resolved non-public IPv4/IPv6 address. DNS is resolved and validated for each hop; redirects are handled manually and revalidated. Requests use no ambient credentials or cookies, identify a generic user agent, accept HTML, time out after 5 seconds, allow at most 3 redirects, and read at most 1 MiB.
- Remote markup is streamed only far enough to extract and normalize the document `<title>`; it is never rendered, executed, or stored.

### Validation limits

- URL: 2,048 characters after trimming; a parseable absolute HTTP(S) address is required.
- Title: 1–300 Unicode characters after trimming.
- Notes: 0–5,000 Unicode characters.
- Tag: 1–40 characters after trimming, maximum 20 distinct tags per bookmark; comparison uses case-folded, whitespace-normalized names.
- Account email: 3–254 characters after normalization; password: 12–128 characters for the first-release account flow.

### Persistence and query strategy

- Schema migrations run transactionally at startup and are recorded in a migrations table.
- Normalized URLs support duplicate discovery but are not a uniqueness constraint, allowing a user to continue intentionally after a warning.
- Collection reads use cursor pagination with a default page size of 50 and maximum of 100. Search is a case-insensitive partial match over title, URL, notes, and tag names; tag filters use intersection semantics.
- Indexes cover ownership plus lifecycle/date ordering, ownership plus normalized URL, bookmark-tag joins, favorite filtering, session expiry, and normalized tag uniqueness.
- All multi-table bookmark/tag mutations run in transactions.

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
│   └── ui-behavior.md
└── tasks.md                 # Created only after plan approval
```

### Source Code (repository root)

```text
src/
├── client/
│   ├── api/
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   └── bookmarks/
│   ├── styles/
│   ├── App.tsx
│   └── main.tsx
├── server/
│   ├── auth/
│   ├── bookmarks/
│   ├── db/
│   │   └── migrations/
│   ├── middleware/
│   ├── title-preview/
│   ├── app.ts
│   └── index.ts
└── shared/
    ├── contracts/
    └── validation/

tests/
├── contract/
├── integration/
├── unit/
└── e2e/

data/                        # Runtime SQLite file; ignored by version control
```

**Structure Decision**: Use one TypeScript package with explicit `client`, `server`, and `shared` boundaries. This keeps deployment to one process and avoids premature workspace complexity while preserving testable separation between UI, domain logic, remote-title retrieval, and persistence.

## Delivery and Verification Strategy

- Implement vertical slices in specification priority order: save/title suggestion, find/open, then organize/maintain.
- Establish migrations, session security, shared schemas, and API error semantics before feature slices.
- Test URL canonicalization, tag normalization, ownership isolation, duplicate continuation, state transitions, and every title-fetch safety rule at unit/integration level.
- Use controlled local HTTP fixtures for title-preview tests; no automated test depends on the public internet.
- Run contract and browser flows from [quickstart.md](quickstart.md), including a 10,000-record search fixture and two-user access-control checks.
- Build the client before the production start check; Express serves the built assets and API from port 4000. Write `.harness/app.json` only during implementation after build and verification commands succeed.

## Complexity Tracking

No constitution violations or additional-project exceptions require justification.
