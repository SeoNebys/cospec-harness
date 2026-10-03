# Implementation Plan: Bookmark Manager

**Branch**: `[001-bookmark-manager]` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Approved feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

Build a responsive single-user bookmark manager as one server-hosted web application. A user pastes a URL, receives a safe best-effort preview containing the page title and cached site icon, may edit the title, and then saves it. Bookmarks and normalized tags persist in SQLite and are exposed through validated application endpoints for create, read, update, delete, search, filtering, stable sorting, and pagination. Metadata retrieval is isolated behind strict SSRF defenses, bounded resource use, inert parsing, and graceful fallback behavior.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24

**Primary Dependencies**: Next.js 16.3.3 App Router, React 19.2, Prisma ORM 7.x with the `better-sqlite3` adapter, Zod, Tailwind CSS 4, Radix Alert Dialog, an inert HTML parser, Undici with a controlled connector, and Sharp for safe icon normalization

**Storage**: Local SQLite database in `data/bookmarks.db`; Prisma-managed forward migrations; application-controlled icon assets in `data/icons/`

**Testing**: Node.js built-in test runner for unit/integration tests; `@playwright/test` 1.61.0 for browser journeys; `@axe-core/playwright` for automated accessibility checks

**Target Platform**: Persistent Linux Node.js server, listening on `0.0.0.0:4000`; current Chromium-class, Firefox, and WebKit browsers on desktop and mobile-sized viewports

**Project Type**: Full-stack web application in a single deployable project

**Performance Goals**: Search, tag filtering, and sorting over 10,000 seeded bookmarks produce a visible first page within 2 seconds for at least 95% of measured attempts; mutations complete promptly except for the explicitly bounded metadata preview

**Constraints**: Single user per installation; no authentication or collaboration in v1; metadata fetch total deadline of 10 seconds; at most 5 redirects; HTML and icon byte limits; no access from the metadata fetcher to non-public network ranges; no user-edited title overwrite; keyboard-accessible core journeys

**Scale/Scope**: Up to 10,000 bookmarks, reusable tags, 50 items per page by default and 100 maximum; one running application instance writing one SQLite file

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The constitution file contains only its unfilled template, so it defines no active project-specific principles or gates. The repository-level SDD rules remain controlling: the approved specification is the source of truth, this plan is presented for approval before tasks, and implementation cannot begin before both gates are approved.

Post-design check: passed. The data model, contracts, and validation guide trace to the approved requirements, introduce no spec changes, and preserve the single-project scope.

## Architecture and Design

### Application boundary

- Next.js App Router renders the initial collection on the server from URL query state (`q`, `tag`, `sort`, and cursor) and hydrates only interactive controls.
- Route Handlers implement the JSON contracts in `contracts/openapi.yaml`. Every payload and query is validated at the boundary with Zod; handlers delegate to server-only services and repositories.
- Bookmark writes and tag-join changes use a single transaction. UI state changes only after a successful response.
- Search, filter, and sort state lives in the URL, enabling reload, history navigation, and shareable local views.

### Save and metadata flow

1. The user pastes a URL and requests a preview.
2. `POST /api/metadata` normalizes and validates the URL, checks for an existing bookmark, and invokes the bounded metadata fetcher.
3. The fetcher retrieves inert HTML, extracts the first document title and a suitable icon candidate, and returns an editable preview. Failure returns a URL-derived fallback title and warning rather than blocking the flow.
4. An icon candidate is fetched through the same security boundary, decoded, resized, stripped of metadata, and saved as an app-controlled PNG. Unsupported or failed icons use the bundled generic icon.
5. The user edits the title/note/tags if desired and submits `POST /api/bookmarks`. The server normalizes and validates again, creates the bookmark and tag relationships transactionally, and marks the title origin so later refreshes cannot overwrite a user edit.

### Metadata security boundary

- Accept only HTTP(S) URLs, reject credentials and nonstandard ports, normalize international hostnames, and reject literal or resolved addresses that are not globally reachable.
- Resolve A and AAAA records for every hop, reject the hop if any answer is disallowed, connect to a validated address while retaining hostname verification, and verify the peer address. Never perform validation followed by an uncontrolled second DNS lookup.
- Disable automatic redirects; follow at most five manually and repeat complete validation at each hop.
- Send no user credentials, cookies, or ambient proxy configuration. Apply connect, first-byte, and 10-second total deadlines, concurrency/rate limits, accepted content types, and compressed/decompressed byte caps.
- Parse HTML without script execution or subresource loading. Never expose network diagnostics or fetched response bodies to the browser.
- Fetch icons with the same network controls, reject SVG and unrecognized formats, cap input at 256 KiB, normalize to a small raster image, and serve it from the app origin with `nosniff` and a restrictive content policy.
- Deployment should additionally deny metadata-worker egress to loopback, local, cluster, and cloud-metadata networks; application checks remain mandatory defense in depth.

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
└── tasks.md                 # created only after plan approval
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
├── bookmarks/[id]/edit/page.tsx
├── globals.css
├── layout.tsx
└── page.tsx
components/
├── bookmark-card.tsx
├── bookmark-form.tsx
├── bookmark-list.tsx
├── delete-bookmark-dialog.tsx
├── filters.tsx
├── metadata-preview.tsx
└── ui/
lib/
├── bookmarks/
│   ├── repository.ts
│   ├── schemas.ts
│   └── service.ts
├── db/
│   ├── client.ts
│   └── migrate.ts
├── metadata/
│   ├── fetcher.ts
│   ├── html.ts
│   ├── icons.ts
│   ├── network-policy.ts
│   └── service.ts
├── tags/normalize.ts
├── urls/normalize.ts
└── errors.ts
prisma/
├── migrations/
└── schema.prisma
public/
└── generic-site-icon.svg
data/
└── icons/                    # runtime data; ignored by version control
tests/
├── e2e/
├── integration/
├── security/
└── unit/
```

**Structure Decision**: Use one Next.js project because the feature is a cohesive single-user application and does not require independently deployed frontend and backend services. Database and network access remain in server-only modules, while the `app/api` boundary keeps browser interactions contract-testable.

## Verification Strategy

- Unit tests cover URL and Unicode tag normalization, validation, fallback titles, search escaping, sort cursors, and metadata parsing.
- Security tests cover private/special IP spellings, mixed DNS answers, rebinding-resistant connections, redirect revalidation, redirect loops, non-HTTP redirects, size/decompression limits, slow responses, false content types, unsafe icons, and sanitized errors.
- Repository integration tests use isolated databases to cover migrations, uniqueness races, transactions, cascade/orphan cleanup, Unicode search, stable pagination, and rollback.
- A deterministic 10,000-bookmark suite measures the specified query paths against the 2-second target.
- Playwright verifies all three user stories, failure and duplicate states, mobile layout, keyboard-only operation, focus restoration after confirmation, live status feedback, and automated accessibility scans. Manual checks cover issues automation cannot detect.
- Production build and startup are verified on `0.0.0.0:4000`; readiness is marked with `data-harness-ready="true"` only after the initial usable state loads.

## Complexity Tracking

No constitution violations or exceptional complexity waivers are required. The hardened metadata boundary is necessary because retrieving user-selected URLs is a core approved requirement and creates an SSRF risk that cannot safely be handled by a generic fetch call.
