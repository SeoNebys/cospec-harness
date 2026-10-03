# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Approved specification at `specs/001-bookmark-manager/spec.md`

## Summary

Build a single-user server-backed web app for automated bookmark capture, normalized deduplication, read/archive states, safe Markdown notes, expressive and saved search, transactional bulk actions, browser HTML import/export, and persistent display preferences. A Next.js/React TypeScript monolith serves the UI and server operations; SQLite with FTS5 supplies durable relational and text search storage.

## Technical Context

**Language/Version**: TypeScript 7.0.2 on Node.js 24 LTS (`>=24.15 <25`)  
**Primary Dependencies**: Next.js 16.3.5, React 19.3.0, Drizzle ORM 0.45.2, better-sqlite3 13.0.3, Zod 4.6.5, Cheerio 1.2.0, parse5 8.0.1, unified/remark/rehype  
**Storage**: SQLite with WAL, foreign keys, busy timeout, migrations, and FTS5  
**Testing**: Vitest 4.2.0, Testing Library React 16.3.3, jsdom 30.1.0, Playwright 1.61.0  
**Target Platform**: Linux responsive web app; Chromium primary automated target  
**Project Type**: Single full-stack web application  
**Performance Goals**: 95% of collection operations under 1 second at 10,000 bookmarks; bulk under 10 seconds  
**Constraints**: One user/process; `0.0.0.0:4000`; guarded outbound networking; no public multi-tenant exposure  
**Scale/Scope**: 10,000 bookmarks and bulk targets; eight primary journeys

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The constitution contains only unratified placeholders and imposes no enforceable technology rules. The repository SDD gates remain binding: approved specification, reviewed plan, tasks, then implementation. The design is one deployable application with independently testable services and no unexplained complexity.

Post-design check: **PASS**. Data, contracts, and validation scenarios trace to approved requirements.

## Architecture and Design

- Next.js App Router renders UI and hosts same-origin route handlers. Handlers validate input and call framework-independent services; services own transactions and rules.
- SQLite is authoritative. Normalized URL, tag name, and saved-search name have unique constraints. FTS5 indexes title, URL, description, visible note text, and tag text.
- A private lexer/parser creates a typed search AST. Parameterized relational/FTS compilation never passes user syntax directly to SQL.
- Metadata/favicon retrieval uses a guarded server client: each redirect and resolved IP is checked, content/time is bounded, HTML is inert, and icons are decoded and re-encoded locally.
- Notes retain Markdown source and render only the approved allowlisted structures and safe link protocols.
- Bulk preview tokens store a server-side target snapshot. Execution recomputes exact eligibility in a transaction; set changes require reconfirmation.
- Import stages tolerant Netscape-style HTML parsing before a transaction. Export emits escaped UTF-8 compatible HTML with disclosed losses.

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
│   ├── api.yaml
│   └── search-grammar.md
└── tasks.md                 # generated after plan approval
```

### Source Code

```text
src/
├── app/
│   ├── api/
│   ├── archive/
│   ├── bookmarks/
│   ├── preferences/
│   ├── saved-searches/
│   ├── layout.tsx
│   └── page.tsx
├── features/
│   ├── bookmarks/
│   ├── collection/
│   ├── import-export/
│   ├── preferences/
│   ├── saved-searches/
│   └── search/
├── lib/{search,validation,url}/
└── server/{db,repositories,security,services}/
drizzle/
data/                         # runtime DB/icons; gitignored
tests/{unit,integration,contract,e2e,fixtures}/
```

**Structure Decision**: One full-stack project avoids a second API deployment and CORS boundary. Dependency direction is `app handlers → services → repositories/database`; pure URL, validation, and search modules have no framework imports.

## Delivery and Operations

- `npm start` serves the built app on `0.0.0.0:4000`; the final harness manifest uses that command.
- `DATABASE_PATH` selects writable storage. Startup runs migrations and enables WAL, foreign keys, and busy timeout.
- Direct dependencies and Playwright 1.61.0 are exact-pinned; `package-lock.json` is committed and validation uses `npm ci`.
- Shutdown closes the database; backup uses SQLite's consistent backup mechanism.
- This app is only safe in an intended private single-user environment until authentication receives its own specification.

## Complexity Tracking

No constitution violations or unnecessary additional projects were identified.
