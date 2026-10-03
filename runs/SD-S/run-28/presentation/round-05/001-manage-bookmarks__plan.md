# Implementation Plan: Bookmark Manager

**Branch**: `001-manage-bookmarks` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Status**: Approved on 2026-09-27

**Input**: Approved feature specification from `specs/001-manage-bookmarks/spec.md`

## Summary

Build a responsive, account-based bookmark manager as a single full-stack web application. A user can paste only an HTTP(S) address; the server safely retrieves public page metadata, stores an automatic or fallback title plus optional description/icon, and returns a usable bookmark even when retrieval fails. The same application provides private libraries, tags, favorites, search, filtering, editing, archiving, restoration, and confirmed deletion.

The implementation uses a Next.js 16 App Router application on Node.js 24 LTS, Better Auth for email/password accounts and database-backed sessions, SQLite in WAL mode for durable local storage, FTS5 for search, and a guarded `undici`/Cheerio metadata pipeline. The architecture remains a single deployable process because the approved scope does not require distributed services.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 LTS

**Primary Dependencies**: Next.js 16.x (App Router), React 19.x, Better Auth, `better-sqlite3`, Zod, `undici`, Cheerio, `ipaddr.js`, Nodemailer, Lucide React

**Storage**: One SQLite database file in WAL mode; FTS5 virtual table for bookmark search; bounded icon bytes stored as deduplicated database assets

**Testing**: Vitest 5 for unit/integration/contract tests; Playwright 1.61.0 pinned to the supplied browser runtime for end-to-end and accessibility checks

**Target Platform**: Linux container running a Node.js server, serving current Chrome, Edge, Firefox, and Safari-class browsers; HTTP listener `0.0.0.0:4000`

**Project Type**: Single full-stack web application

**Performance Goals**: Search/filter results within 2 seconds for 95% of requests against a 10,000-bookmark library; metadata titles visible within 5 seconds for 95% of reachable pages with standard titles; normal library interactions provide visible feedback within 100 ms

**Constraints**: Every query and mutation must be scoped to the authenticated user; metadata retrieval must resist SSRF and DNS rebinding; only HTTP(S) destinations are eligible; metadata work has a strict 4-second total budget; bookmark saving falls back rather than failing when metadata is unavailable; HTML and icon downloads are size-bounded; the application is a single-node deployment because SQLite is local

**Scale/Scope**: At least 10,000 bookmarks and 500 distinct tags per user; individual-user private libraries; one production application process with persistent storage; seven principal screens/states (register, sign in, recovery request, reset, active library, archived library, edit/delete overlays)

## Constitution Check

*GATE: Passed before research and passed again after design.*

The constitution file is still an unfilled template and establishes no enforceable project principles. The repository-level SDD gates are authoritative for this feature:

- Specification exists, passed its quality checklist, and was explicitly approved by the client: **PASS**.
- This artifact contains planning and design only; it does not implement the application: **PASS**.
- No unsupported complexity is introduced: one application, one database, and no background worker or separate API service: **PASS**.
- User-visible behavior remains traceable to the approved requirements and success criteria: **PASS**.
- Phase 1 design preserves account isolation and the public-only metadata retrieval boundary: **PASS**.

## Architecture and Delivery Strategy

### Request and rendering model

- Server-render authenticated pages for fast initial and empty-state delivery; hydrate only interactive controls such as the save composer, filters, dialogs, and optimistic favorite/archive actions.
- Expose bookmark and tag operations through versioned JSON route handlers under `/api`. Keep Better Auth's conventional `/api/auth/*` handler for identity and session flows.
- Put authorization in the data-access layer as well as the route layer. Repository methods accept the authenticated user ID and never fetch or mutate a bookmark by bookmark ID alone.
- Use opaque cursor pagination based on `(created_at, id)`, with 50 bookmarks per page by default and a maximum of 100.

### Save and metadata flow

1. Validate and normalize the submitted address; add HTTPS when the scheme is omitted, reject credentials/fragments for retrieval, and permit only HTTP or HTTPS.
2. Check the authenticated user's existing normalized addresses. Return a duplicate-warning response before any outbound request unless `allowDuplicate` is explicitly set.
3. Attempt metadata retrieval within one 4-second budget. Use a browser-like but identifiable user agent, request HTML only, disable automatic redirects, and validate every redirect target.
4. Resolve each target at connection time and reject loopback, private, link-local, multicast, unspecified, reserved, and cloud-metadata destinations for both IPv4 and IPv6. Reject the request if any resolved address is non-public.
5. Read at most 1 MiB of HTML/XML and parse it from bytes with Cheerio. Choose the title in this order: Open Graph title, document title, Twitter title. Choose description from Open Graph, standard description, then Twitter description. Normalize whitespace and enforce the field limits below.
6. Resolve the best published icon URL against the final page URL. Fetch it through the same guarded network path within the remaining time budget; accept only PNG, JPEG, GIF, or WebP bytes up to 128 KiB. Deduplicate accepted assets by SHA-256. SVG and active content are not stored.
7. If no usable title is obtained for any reason, derive a readable fallback from the final validated hostname/path. Save the bookmark with a failed/partial metadata status and a non-blocking explanation.
8. Persist the bookmark, tag associations, icon reference, and search document in one transaction. Return the complete saved representation.

### Authentication and privacy

- Use Better Auth's email/password mode with its SQLite adapter, database sessions, secure HTTP-only same-site cookies, password reset, and revocation of all sessions after password reset.
- Use an SMTP mail adapter in deployed environments. Development and automated tests use an in-memory mail sink so recovery can be verified without an external service.
- Enforce same-origin mutation requests, validate JSON content types, rate-limit registration/sign-in/recovery/metadata endpoints, and return the same recovery response whether or not an account exists.
- Validate the session in every protected page and API handler. The routing proxy provides only an early redirect; it is not the authorization boundary.

### Search and consistency

- Maintain an FTS5 search row per bookmark containing title, normalized address, retrieved description, notes, and a normalized tag string.
- Update the FTS row in the same transaction as bookmark or tag changes. Delete it in the same transaction as permanent deletion.
- Combine FTS matches with user ID, lifecycle state, favorite state, and tag-intersection predicates. User ownership is applied before result materialization.
- Use an integer `version` on bookmarks for optimistic concurrency. Stale edits receive a conflict response and never silently overwrite a newer update.

### Validation limits

| Field/resource | Limit and rule |
|---|---|
| Web address | 2,048 characters after trimming; valid HTTP(S); no embedded credentials |
| Title | 1–300 Unicode characters after whitespace normalization |
| Retrieved description | 1,000 Unicode characters, plain text only |
| Notes | 5,000 Unicode characters |
| Tag name | 1–50 Unicode characters after trimming; case-insensitive uniqueness |
| Tags per bookmark | 25 |
| Distinct tags per user | 500 |
| HTML metadata response | 1 MiB maximum body |
| Stored icon | 128 KiB; PNG, JPEG, GIF, or WebP only |
| Redirects | At most 5, with full validation at every hop |
| Metadata operation | 4 seconds total, including redirects and icon attempt |

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-bookmarks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── auth.md
│   └── openapi.yaml
└── tasks.md                 # Created only after plan approval
```

### Source Code (repository root)

```text
app/
├── (auth)/
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (library)/
│   ├── bookmarks/page.tsx
│   └── archive/page.tsx
├── api/
│   ├── auth/[...all]/route.ts
│   ├── bookmarks/route.ts
│   ├── bookmarks/[id]/route.ts
│   ├── icons/[id]/route.ts
│   └── tags/route.ts
├── layout.tsx
├── page.tsx
└── globals.css

components/
├── auth/
├── bookmarks/
├── filters/
└── ui/

lib/
├── auth/
├── bookmarks/
├── db/
├── mail/
├── metadata/
├── security/
└── validation/

db/
├── migrations/
└── seed.ts

tests/
├── unit/
├── integration/
├── contract/
├── e2e/
└── fixtures/

public/
scripts/
data/                         # Runtime database; ignored by version control
```

**Structure Decision**: Use a single Next.js project with feature-oriented server modules under `lib/` and thin route handlers under `app/api/`. This preserves one deployable unit while keeping metadata security, authentication, persistence, and bookmark rules independently testable. No separate frontend/backend projects or job worker are needed for the approved scope.

## Verification Strategy

- Unit tests cover URL normalization, public-address classification, redirect validation, metadata precedence/fallbacks, field limits, tag normalization, query parsing, and authorization predicates.
- Integration tests use a temporary SQLite database and injected network transport/mail sink. They prove transactionality, FTS synchronization, duplicate decisions, optimistic conflicts, session isolation, archive/restore/delete transitions, and reset-token behavior.
- Contract tests validate every response against `contracts/openapi.yaml` and the Better Auth flows in `contracts/auth.md`.
- Playwright tests cover the three prioritized user stories at desktop and mobile widths, keyboard-only operation, empty/error states, and cross-account isolation. The installed Playwright 1.61.0 browser bundle is reused rather than downloaded.
- Performance fixtures seed 10,000 bookmarks and 500 tags for one user, then measure search/filter latency over repeated representative queries.
- Metadata security tests include private IPv4/IPv6 literals, alternate IP encodings, credentials in URLs, DNS answers containing any non-public address, safe-to-unsafe redirects, redirect loops, oversized bodies, slow responses, wrong media types, and oversized/active icons.

## Deployment and Operations

- Build with `npm run build`; start the prepared application with `npm start`, which runs the server on `0.0.0.0:4000`.
- Store the database beneath `data/` on persistent storage; run idempotent migrations before server start and maintain file-level backups with WAL checkpoint coordination.
- Required production configuration: application base URL, 32-byte-or-stronger auth secret, database path, SMTP connection details, sender address, and trusted origin.
- Emit structured logs for request ID, operation, duration, metadata outcome, and error category. Never log passwords, session tokens, reset tokens, notes, full query strings, or fetched page bodies.
- Expose a shallow health endpoint that confirms process readiness and database access without performing external network calls.
- When implementation is ready, write `.harness/app.json` with `{"kind":"application","port":4000,"path":"/bookmarks","start_command":["npm","start"],"start_cwd":"/work"}` and place `data-harness-ready="true"` only on a fully loaded auth or library state.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Metadata fetching becomes an SSRF path | Connection-time public-IP enforcement, manual redirect validation, protocol restriction, response/time limits, and hostile-network integration tests |
| Metadata retrieval slows saving | Four-second total budget, no retries, clear fallback title, optional icon retrieval only within remaining budget |
| SQLite blocks under excessive write concurrency | WAL mode, short transactions, bounded single-process deployment; reassess PostgreSQL only if real concurrency exceeds this release's scope |
| Search index drifts from source data | Update source rows and FTS rows in one transaction; add rebuild command and consistency test |
| Password recovery leaks account existence | Uniform API response and timing-aware asynchronous mail dispatch |
| Remote page markup or icons introduce active content | Store only normalized plain text and bounded raster image types; never render fetched HTML or SVG |
| User edits are overwritten | Persist `title_source=user`; metadata writes must not replace user-owned titles |

## Gate Result

Phase 0 research resolved every technical unknown. Phase 1 produced the data model, public interface contracts, and runnable validation guide. The post-design constitution re-check passes with no exceptions and no complexity-tracking entries.
