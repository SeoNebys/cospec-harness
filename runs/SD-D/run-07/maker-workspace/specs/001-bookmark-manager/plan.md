# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a personal bookmark manager as one self-hosted TypeScript web application. Next.js serves the React interface, server operations, and metadata endpoint from a single Node.js process. SQLite provides durable local storage, FTS5 indexing, relational tags, and transactional bulk operations. A dedicated query parser supports exact phrases, `tag:` predicates, Boolean operators, and grouping without passing raw user syntax to SQLite. Metadata retrieval runs only on the server through an SSRF-resistant fetch boundary with bounded redirects, time, bytes, and content types; safe raster icons are stored and served locally.

## Technical Context

**Language/Version**: TypeScript 5.x in strict mode on Node.js 24 LTS

**Primary Dependencies**: Next.js 16.3.x, React 19.3.x, Tailwind CSS 4.3.x, `better-sqlite3` 13.x, Undici, Cheerio, and `ipaddr.js`; exact versions pinned in the lockfile during implementation

**Storage**: One file-backed SQLite database with WAL mode and FTS5; locally cached, validated raster site icons under a configurable data directory

**Testing**: Vitest for unit and service tests, React Testing Library and `user-event` for UI behavior, real temporary SQLite databases for integration tests, and Playwright 1.61.0 for end-to-end and accessibility workflows

**Target Platform**: Self-hosted Linux process; responsive modern browser UI; HTTP server bound to `0.0.0.0:4000`

**Project Type**: Full-stack web application in a single deployable project

**Performance Goals**: Search/filter/sort and individual mutations resolve visibly within 1 second at 10,000 bookmarks; a 1,000-item bulk operation reports within 5 seconds; eligible page metadata previews within 5 seconds for at least 90% of reachable pages

**Constraints**: Single-user and single writable instance; durable same-installation data; keyboard-accessible primary flows; no raw remote HTML rendering; metadata egress must resist SSRF and DNS rebinding; no cross-device synchronization

**Scale/Scope**: One user, at least 10,000 bookmarks, at least 1,000 items per bulk action, five primary views (all, unread, favorites, archived, bookmark detail/editor)

## Constitution Check

*GATE: Passed before research and passed again after design.*

The constitution file contains only unconfigured template placeholders, so it defines no enforceable project-specific principles. The governing constraints are the approved specification and repository SDD workflow.

- Specification approval: **PASS** — the client approved `spec.md` before planning.
- Phase boundary: **PASS** — only design artifacts are produced; no application code or task breakdown.
- Simplicity: **PASS** — one process and one embedded database fit the single-user scope.
- Testability: **PASS** — parsing, storage, metadata policy, UI behavior, and end-to-end flows have explicit validation seams.
- Security: **PASS** — remote retrieval is isolated behind hop-by-hop URL/network validation and resource limits.
- Post-design review: **PASS** — data model and contracts preserve the approved requirements without external services or multi-user complexity.

## Architecture

### Request and data flow

1. Server-rendered route shells load bookmark lists and detail records through repository-backed services.
2. Small client islands manage the search editor, selection, optimistic status toggles, dialogs, and notifications.
3. URL query parameters are canonical for view, search, filters, sort, and pagination.
4. Server Actions validate bookmark, tag, status, archive, and bulk mutations through domain services.
5. `POST /api/metadata` is the JSON boundary for cancellable previews and never returns remote markup.
6. Repository transactions update relational data and the FTS shadow index together.
7. Bulk previews snapshot exact bookmark IDs; confirmation uses per-item savepoints and returns partial-success details.

### Security boundaries

- Normalize with the WHATWG URL parser; allow only `http`/`https`, no credentials, and ports 80/443 in the first release.
- Resolve and classify every address for every request and redirect; reject any non-public IPv4/IPv6 result and pin the validated address while preserving Host/TLS identity.
- Allow five redirects, forbid HTTPS-to-HTTP downgrade, cap HTML at 1 MiB, enforce an 8-second total deadline, and accept only HTML/XHTML.
- Parse bounded static HTML without executing scripts and retain normalized text only.
- Fetch at most three icon candidates under the same policy, cap each at 256 KiB, reject SVG/HTML, validate raster signatures, and serve accepted icons locally.
- Log host, outcome category, duration, and byte count, never full query strings or upstream bodies.

## Project Structure

### Documentation

```text
specs/001-bookmark-manager/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── metadata-api.yaml
│   ├── search-grammar.md
│   └── ui-actions.md
└── tasks.md                  # Created only after plan approval
```

### Source Code

```text
app/
├── api/metadata/route.ts
├── bookmarks/[id]/page.tsx
├── icons/[id]/route.ts
├── archived/page.tsx
├── favorites/page.tsx
├── unread/page.tsx
├── actions.ts
├── layout.tsx
└── page.tsx
components/
├── bookmarks/
├── bulk-actions/
├── search/
└── ui/
lib/
├── db/
│   ├── migrations/
│   ├── connection.ts
│   └── repositories/
├── bookmarks/
├── bulk/
├── metadata/
├── search/
└── validation/
public/
styles/
data/                         # Runtime-only database and icon cache; ignored
tests/
├── contract/
├── integration/
├── performance/
├── unit/
└── e2e/
```

**Structure Decision**: Use one Next.js App Router project. Route components and narrow client components live in `app/` and `components/`; framework-independent domain, repository, parser, and fetch-policy code lives in `lib/`. This preserves one deployment while keeping security-sensitive and testable logic out of UI handlers.

## Delivery and Operations

- Build with `npm run build`; start using `npm start` on `0.0.0.0:4000`.
- Store SQLite and icons outside build output in a configurable directory, default `/work/data` for review.
- Apply versioned migrations before accepting requests; fail clearly if FTS5 or required schema capabilities are absent.
- Create `/work/.harness/app.json` during implementation only after dependencies, migrations, and production build are ready.
- Run one writable instance. Use SQLite-aware backup/checkpoint behavior, not a blind copy of an active WAL database.

## Complexity Tracking

No constitution violations require justification. The custom search parser and hardened metadata transport are necessary for approved Boolean syntax and safe arbitrary-URL retrieval; each remains an isolated, independently tested module.
