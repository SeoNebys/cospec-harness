# Implementation Plan: Bookmark Manager

**Branch**: `001-manage-bookmarks` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Approved feature specification from `specs/001-manage-bookmarks/spec.md`

## Summary

Build a responsive, single-user bookmark web application as one self-hosted TypeScript/Node process. A React interface supports bookmark CRUD, tags, search, filtering, feedback, and keyboard access. Server routes persist normalized records in SQLite and retrieve page metadata through a tightly bounded, SSRF-resistant fetcher. The client tracks request identity and field edits so late metadata results cannot overwrite a newer URL or user-entered text.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 LTS

**Primary Dependencies**: Next.js 16 (App Router) with React; Zod for boundary validation; Drizzle ORM with `better-sqlite3`; Cheerio for non-executing HTML metadata parsing

**Storage**: Local SQLite file in `data/bookmarks.db`, managed by versioned SQL migrations; temporary isolated databases for tests

**Testing**: Vitest; React Testing Library and `user-event`; MSW; Playwright Test 1.61.0; `@axe-core/playwright`

**Target Platform**: Modern desktop/mobile browsers; self-hosted Linux Node process bound to `0.0.0.0:4000`

**Project Type**: Full-stack web application in one repository and deployable process

**Performance Goals**: Search/filter feedback visible within 1 second for 1,000 bookmarks; metadata retrieval ends within 10 seconds; primary local CRUD interactions provide visible feedback within 500 ms under expected load

**Constraints**: Single user and no authentication in v1; same-origin interface only; durable local persistence; metadata fetches allow only globally routable HTTP(S) destinations and consume bounded time/body/redirect resources; user content is always rendered as text

**Scale/Scope**: One responsive application surface, one SQLite database, up to 1,000 bookmarks, two core entities plus their join relation, six JSON operations across four routes

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The repository constitution is still an unfilled template and defines no enforceable project-specific principles. The governing `AGENTS.md` requires specification-driven development and explicit spec and plan approvals. The approved specification exists, this plan is being presented at its required approval gate, and no implementation or task generation has begun. The design remains intentionally small: one application, one process, one database, and no unnecessary distributed services.

**Post-design re-check**: Passed. The data model, same-origin contracts, validation guide, and research decisions remain within the approved feature boundaries. No constitutional exception or complexity waiver is needed.

## Architecture and Data Flow

1. The application server renders the initial newest-first bookmark view and serves the React interface.
2. Browser interactions call same-origin JSON route handlers. Shared Zod schemas validate boundary data; the server remains authoritative.
3. Bookmark services normalize URLs and tags, enforce duplicates and limits, and execute transactional repository operations against SQLite.
4. Pasting a valid URL starts a debounced metadata-preview request. The client records the current request identity plus title/description dirty flags.
5. The server metadata service validates and resolves the destination, pins a validated public address for the connection, manually revalidates redirects, streams a bounded HTML response, and extracts inert text only.
6. The client applies returned metadata only when the URL/request still matches and the corresponding field remains untouched. Partial and failed retrievals use the specified editable fallback.

## Key Design Decisions

- **One Next.js application**: Route handlers and UI share types and deployment while metadata access and SQLite remain server-only.
- **Normalized relational data**: `bookmarks`, `tags`, and `bookmark_tags` enforce unique normalized URLs and case-insensitive tag identity without storing repeated tag strings.
- **Server-authoritative filtering**: Search and tag filters are query parameters on the collection endpoint, making behavior consistent after mutations and easy to contract-test.
- **Explicit preview endpoint**: Metadata retrieval is separate from bookmark creation so the user can review/edit results and saving still works when retrieval fails.
- **Safe outbound networking**: The fetcher accepts only HTTP(S) on ports 80/443, rejects credentials and any non-global DNS answer, pins the validated address, and repeats checks for each manual redirect.
- **Deterministic failure contract**: Metadata failures return stable categories and safe messages without leaking DNS, IP, response-body, or stack details.
- **Progressive accessibility**: Semantic HTML, labelled controls, status/error live regions, focus-managed confirmation dialog, role-based automated tests, axe scans, and manual keyboard validation cover the core flows.

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-bookmarks/
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
├── api/
│   ├── bookmarks/
│   │   ├── [id]/route.ts
│   │   └── route.ts
│   ├── metadata/route.ts
│   └── tags/route.ts
├── layout.tsx
├── page.tsx
└── styles.css

components/
├── bookmark-card.tsx
├── bookmark-form.tsx
├── bookmark-list.tsx
├── delete-dialog.tsx
├── search-controls.tsx
└── status-message.tsx

lib/
├── contracts/
│   ├── bookmark.ts
│   └── metadata.ts
├── client/
│   ├── api.ts
│   └── metadata-controller.ts
└── server/
    ├── db/
    │   ├── migrations/
    │   ├── connection.ts
    │   ├── repository.ts
    │   └── schema.ts
    ├── bookmarks.ts
    ├── metadata-fetcher.ts
    ├── metadata-parser.ts
    ├── network-policy.ts
    └── same-origin.ts

data/
└── .gitkeep

tests/
├── fixtures/
│   └── metadata-pages/
├── unit/
├── integration/
├── component/
└── e2e/
```

**Structure Decision**: Use one full-stack Next.js project. Route handlers isolate transport concerns, `lib/server` contains testable domain/persistence/network logic, shared runtime contracts live in `lib/contracts`, and client race/dirty-state handling is isolated from visual components. This is sufficient for the approved single-user scope without separate frontend/backend packages.

## Security and Reliability Controls

- Parse destinations with the standard URL parser; accept only `http:` and `https:`, no embedded credentials, and ports 80/443.
- Resolve all A/AAAA answers, normalize mapped addresses, and reject the entire destination if any answer is loopback, private, link-local, multicast, unspecified, reserved, documentation-only, carrier-grade NAT, or otherwise non-global.
- Pin the outbound connection to a validated answer while retaining the original hostname for HTTP Host and TLS SNI, preventing validation/fetch DNS drift.
- Disable automatic redirects; allow at most five, resolving and fully validating every target before connecting.
- Apply one eight-second deadline across DNS, redirects, and body streaming, leaving application overhead under the ten-second user-facing limit.
- Accept only successful HTML/XHTML responses, cap decoded content at 2 MiB, execute no scripts, load no subresources, and extract only normalized title/description text.
- Do not forward cookies or authorization. Rate-limit metadata previews and avoid logging full URLs, query strings, response bodies, or extracted content.
- Require same-origin JSON mutation requests and expose no permissive CORS policy. Render all stored and retrieved strings as text.

## Verification Strategy

- **Unit**: URL/tag normalization, duplicate identity, search/filter rules, metadata precedence/sanitization, network classification, timeout/body/redirect budgets, and fallback mapping.
- **Component**: Paste/loading/autofill, dirty-field protection, stale-response rejection, failure fallback, validation, accessible status messages, delete dialog focus/cancel/confirm, and keyboard navigation.
- **Integration/contract**: Real route handlers with a temporary SQLite database and injected deterministic metadata fixture server; validate every success/error response against shared schemas and `contracts/openapi.yaml`.
- **End to end**: Save with autofill and override, fallback save, persistence after reload, search, tag filter, edit, duplicate handling, and delete cancel/confirm in Chromium.
- **Accessibility**: Axe scans across empty/populated/form/filter/fallback/dialog states plus manual keyboard checks for focus order, visible focus, announcements, Escape, and focus restoration.
- **Network isolation**: Automated tests never depend on public websites; a local fixture server supplies HTML, redirects, failures, slow bodies, oversized bodies, and content-type variants.

## Complexity Tracking

No constitution violations or complexity exceptions require justification.
