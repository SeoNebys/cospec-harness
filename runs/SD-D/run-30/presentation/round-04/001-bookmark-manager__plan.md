# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

Build a personal bookmark-management web application that persists up to 10,000 bookmarks, retrieves page titles and safe visual metadata, prevents duplicate destinations, supports structured search and independent favorite/read-later/archive states, and renders constrained formatted notes safely. The implementation will use a TypeScript browser client and Node.js service in one repository, backed by SQLite. The service owns persistence, search evaluation, URL normalization, metadata retrieval, image caching, and security boundaries; the client owns accessible interaction and presentation.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24; modern evergreen browsers

**Primary Dependencies**: React 19, Vite, Express 5, better-sqlite3, Zod, Markdown rendering with a strict sanitization schema

**Storage**: SQLite database plus database migrations; optional page icons and previews stored as bounded binary media records

**Testing**: Vitest for unit and component tests, Testing Library for accessible UI behavior, Supertest for HTTP contracts, Playwright 1.61.0 for end-to-end validation

**Target Platform**: Linux-hosted web application, served on `0.0.0.0:4000`, used from current desktop and mobile browsers

**Project Type**: Full-stack web application in a single npm workspace

**Performance Goals**: List/search/filter/sort and local state changes complete visibly within 1 second for 10,000 bookmarks; page metadata retrieval is bounded to 8 seconds and always permits manual fallback

**Constraints**: Single-user/no authentication in v1; only `http` and `https` destinations; no duplicate normalized destinations; all outbound retrieval must resist server-side request forgery; notes must not execute active content; primary journeys must be keyboard accessible

**Scale/Scope**: One user, up to 10,000 bookmarks, five primary views (active, favorites, read later, archive, detail/edit), one local database, no browser synchronization or sharing

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

The project constitution is still an uncustomized template and imposes no enforceable project-specific gates. The repository-level SDD instructions are therefore the governing constraints:

- Specification approval: passed; the client approved `spec.md` on 2026-09-27.
- Plan-before-tasks: passed; this document and its Phase 0/1 artifacts precede task generation.
- No implementation before plan approval: passed; only design artifacts exist.
- Traceability: passed; the data model, contracts, and quickstart map back to the approved requirements.
- Simplicity: passed; one deployable application, one database, and no separate infrastructure services are proposed.
- Post-design re-check: passed; Phase 1 adds no exception to the approved scope or workflow.

## Architectural Design

### Runtime boundaries

1. The React client requests and presents bookmark data through `/api` contracts only. It never fetches arbitrary destination pages directly.
2. The Express service validates requests, normalizes destinations, enforces uniqueness, parses search queries, and performs database transactions.
3. A metadata service resolves and fetches public web destinations with strict redirect, address, time, and size limits. It extracts a title and candidate visual URLs, then caches only validated raster imagery.
4. SQLite is the system of record. Foreign keys, uniqueness rules, and transactions enforce consistency independently of the UI.
5. The production server serves the built client and API on port 4000, avoiding cross-origin deployment complexity.

### Key implementation decisions

- Use a shared TypeScript schema package so request, response, validation, and UI types stay aligned.
- Keep data access in focused repositories and business rules in services; HTTP handlers only translate transport concerns.
- Model favorite, read-later, unread/read, and archive state independently. Archiving hides an item from active and unread read-later views without erasing those states.
- Parse the v1 search syntax into a small abstract syntax tree before querying. Parentheses are intentionally rejected rather than interpreted unpredictably.
- Store notes as constrained Markdown source and derive searchable/rendered text from it. Rendering uses an allowlist that admits headings, links, and lists but no raw executable markup.
- Detect duplicates during metadata preview and atomically during create/update, returning the existing bookmark identifier if a race occurs.
- Cache page visuals through the service instead of hotlinking them, preventing routine third-party requests when the collection is viewed.

### Metadata retrieval safety

- Accept only `http:` and `https:` URLs with no embedded credentials.
- Resolve the hostname and reject loopback, private, link-local, multicast, unspecified, and other non-public IPv4/IPv6 ranges before each request.
- Pin the request to a validated resolution and repeat validation for every redirect to prevent DNS rebinding and redirect bypasses.
- Allow at most five redirects, an 8-second total deadline, bounded response headers, 2 MiB of HTML, and 2 MiB per cached image.
- Accept HTML for metadata and raster `image/png`, `image/jpeg`, `image/webp`, or `image/gif` for visuals; reject SVG and active formats.
- Never forward user cookies or authorization headers. Send a fixed user agent and minimal accepted content types.
- Treat retrieval failure as recoverable and return a stable reason code so the client can offer manual title entry.

### Error and accessibility strategy

- API errors use a consistent problem response containing a stable code, human-readable message, and field issues where applicable.
- Forms retain entered values after validation or metadata failures. Destructive deletion requires an explicit confirmation dialog.
- Async metadata state is announced without moving keyboard focus unexpectedly. Dialogs trap and restore focus, every icon action has an accessible name, and all views/actions are keyboard operable.
- Empty collection, no search matches, metadata fallback, loading, and recoverable error states are visually and semantically distinct.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── search-grammar.md
└── tasks.md                 # Created only after plan approval
```

### Source Code (repository root)

```text
package.json
package-lock.json
client/
├── index.html
├── src/
│   ├── app/
│   ├── components/
│   ├── features/bookmarks/
│   ├── features/search/
│   ├── pages/
│   ├── services/
│   └── styles/
└── tests/
server/
├── src/
│   ├── api/
│   ├── db/
│   │   └── migrations/
│   ├── repositories/
│   ├── services/
│   ├── search/
│   ├── security/
│   └── server.ts
└── tests/
    ├── contract/
    ├── integration/
    └── unit/
shared/
├── src/
│   ├── contracts/
│   ├── schemas/
│   └── types/
└── tests/
e2e/
├── fixtures/
└── bookmark-manager.spec.ts
```

**Structure Decision**: Use a single npm workspace with `client`, `server`, and `shared` packages. This keeps one install, lockfile, build, and deployment while preserving the server security boundary and preventing contract drift.

## Verification Strategy

- Unit tests cover URL normalization, public-address enforcement, redirect validation, metadata extraction, note sanitization, state transitions, and every search grammar operator.
- Repository/integration tests run against isolated temporary SQLite databases and verify migrations, uniqueness, tag cleanup, media replacement, archive behavior, and persistence.
- Contract tests validate every request and response in `contracts/openapi.yaml`, including malformed search and duplicate conflict behavior.
- Component tests verify form retention, loading/fallback states, semantic names, focus behavior, and keyboard operation.
- End-to-end tests execute the approved user stories with controlled metadata fixtures, including inaccessible pages and unsafe redirect attempts.
- Performance fixtures seed 1,000 and 10,000 bookmarks and measure the user-visible thresholds from SC-003 and SC-004.

## Delivery and Operations

- `npm run build` produces the client assets and compiled server.
- `npm start` runs the prepared server on `0.0.0.0:4000` and applies pending migrations before accepting requests.
- Runtime data lives under a configurable application-data directory, with the SQLite database and cached imagery covered by the same backup boundary.
- The app exposes a lightweight health endpoint that checks process and database readiness without making outbound requests.
- The implementation phase will create `/work/.harness/app.json` only after dependencies, migrations, build, and browser checks pass.

## Complexity Tracking

No constitution violations or unjustified complexity were identified.
