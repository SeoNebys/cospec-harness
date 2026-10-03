# Implementation Plan: Bookmark Manager

**Branch**: `[001-bookmark-manager]` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

Build a private, single-user bookmark web application that saves, opens, searches, tags, edits, and deletes bookmarks. A user starts by pasting a URL; the server safely retrieves a page title and available description, while a deterministic address-derived fallback keeps saving unblocked when retrieval fails. The solution is a single Node.js service that exposes a same-origin JSON API, serves a React interface, and persists the library in a local SQLite database.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.21; modern browser JavaScript for the client

**Primary Dependencies**: React 19.x, Vite 7.x, Express 5.x, Zod 4.x, Cheerio 1.x, better-sqlite3 13.x

**Storage**: File-backed SQLite database with schema migrations; in-memory SQLite for automated tests

**Testing**: Vitest for unit and integration tests, Supertest for HTTP contract tests, React Testing Library for UI behavior, and Playwright 1.61.0 with Chromium for end-to-end acceptance tests

**Target Platform**: Linux-hosted web service accessed by current desktop and mobile browsers; production server binds to `0.0.0.0:4000`

**Project Type**: Single web application with browser client and same-origin server API

**Performance Goals**: Search and tag-filter results visible within 2 seconds at 10,000 bookmarks; metadata preview visible within 5 seconds for at least 95% of reachable pages that provide metadata

**Constraints**: Private single-user deployment; no authentication in v1; public `http`/`https` destinations only; metadata retrieval must reject local/private network targets, cap redirects and response size, and fail to a saveable title rather than blocking the workflow

**Scale/Scope**: One user, up to 10,000 bookmarks, three primary UI flows (save/open, find/organize, edit/delete), and three API resource groups

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1 design.*

- The constitution file is an unratified placeholder and defines no enforceable project principles or technical constraints.
- The repository's SDD gate is satisfied: `spec.md` was approved by the client on 2026-09-24 before technical planning began.
- This phase creates design artifacts only. No application implementation or task breakdown is included before plan approval.
- The design remains within approved v1 scope: private single-user operation, no accounts, sharing, imports, extensions, folders, rich previews, or offline mode.
- Post-design check: the data model, API contract, and validation guide trace to the approved requirements without adding a second deployment unit or external service dependency.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
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
src/
├── client/
│   ├── api/
│   │   └── client.ts
│   ├── components/
│   │   ├── BookmarkCard.tsx
│   │   ├── BookmarkEditor.tsx
│   │   ├── BookmarkList.tsx
│   │   ├── DeleteConfirmation.tsx
│   │   ├── EmptyState.tsx
│   │   ├── SaveBookmarkForm.tsx
│   │   └── SearchAndFilter.tsx
│   ├── hooks/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── server/
│   ├── api/
│   │   ├── bookmarks.ts
│   │   ├── metadata.ts
│   │   └── tags.ts
│   ├── db/
│   │   ├── client.ts
│   │   ├── migrations.ts
│   │   └── bookmark-repository.ts
│   ├── services/
│   │   ├── metadata-fetcher.ts
│   │   ├── metadata-parser.ts
│   │   └── url-policy.ts
│   ├── app.ts
│   └── index.ts
└── shared/
    ├── schemas.ts
    └── types.ts

tests/
├── unit/
│   ├── client/
│   └── server/
├── integration/
│   ├── api/
│   └── metadata/
├── e2e/
│   └── bookmarks.spec.ts
└── fixtures/
    └── metadata-pages.ts

data/                         # Runtime database; contents ignored by version control
public/
package.json
package-lock.json
tsconfig.json
vite.config.ts
playwright.config.ts
```

**Structure Decision**: Use one npm package and one production Node process. Vite builds the client into static assets served by Express, while `/api/*` routes remain same-origin. Shared schemas keep client requests and server validation aligned without introducing a multi-package workspace.

## Architecture and Delivery Decisions

### Request Flow

1. The browser submits a pasted address to `POST /api/metadata`.
2. The server validates and normalizes the address, enforces the public-network URL policy, and attempts a bounded metadata fetch.
3. The server returns either retrieved page details or a fallback title plus a non-blocking warning.
4. The browser exposes editable title, description, and tags, then submits the final values to `POST /api/bookmarks`.
5. The server validates the payload, reports a possible duplicate with `409 Conflict`, and creates it only after an explicit duplicate override.
6. Library search and tag filtering use `GET /api/bookmarks`; edits and confirmed deletes use resource-specific endpoints.

### Metadata Retrieval Boundary

- Accept only absolute `http` or `https` URLs without embedded credentials.
- Resolve every hostname to all IPv4 and IPv6 addresses and reject the request if any result is loopback, private, link-local, multicast, unspecified, or otherwise non-public.
- Connect through a vetted, pinned address while preserving the hostname for HTTP host and TLS verification, preventing a second uncontrolled DNS resolution.
- Follow redirects manually, applying the complete URL and address policy to every hop, with at most three redirects.
- Stop after four seconds, one mebibyte of response data, or a non-HTML content type.
- Parse only HTML received from the remote page; do not execute scripts. Prefer the page's social title and description when supplied, then the document title and standard description metadata; normalize whitespace and apply field limits.
- Convert all retrieval failures into a successful fallback preview for otherwise valid public URLs. Invalid or unsafe URLs remain validation errors.

### Persistence and Querying

- Run idempotent, versioned migrations at startup before accepting traffic.
- Store bookmarks and tags in normalized relational tables with a many-to-many join table and foreign-key cascades.
- Use transactions for create/update operations that replace tag associations.
- Normalize URLs for duplicate detection while allowing intentional duplicates after confirmation.
- Search title, address, description, and associated tag names case-insensitively; combine search and a single tag filter with newest-first ordering.

### Error and UI State

- Return one structured error envelope across all endpoints with a stable code, user-readable message, and optional field.
- Distinguish invalid/unsafe addresses from remote metadata failures: the former block saving, while the latter display a warning and fallback title.
- Keep search text and tag selection in browser state when a destination opens in a new tab.
- Use accessible native forms and dialogs, visible focus, keyboard operation, status announcements for metadata loading, and clear empty/loading/error states.

### Verification Strategy

- Unit-test URL normalization, address classification, fallback-title creation, metadata parsing, schema validation, and tag normalization.
- Integration-test every API response against `contracts/openapi.yaml` using an isolated in-memory database.
- Test metadata redirects, DNS rebinding defenses, timeouts, oversized responses, non-HTML responses, missing metadata, and successful extraction through injected deterministic network fixtures.
- Component-test save, duplicate-warning, search/filter, edit, and delete-confirmation states.
- Run Playwright acceptance scenarios for all three user stories at desktop and mobile-sized viewports. Mock only the remote destination boundary; keep the application API and database real.
- Seed 10,000 bookmarks for the search/filter performance acceptance check.

## Post-Design Constitution Check

**Result**: Passed. No constitutional violations exist, no complexity exception is needed, and all Phase 1 artifacts remain within the approved specification.
