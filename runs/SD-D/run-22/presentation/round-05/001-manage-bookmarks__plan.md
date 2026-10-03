# Implementation Plan: Personal Bookmark Manager

**Branch**: `001-manage-bookmarks` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Approved feature specification from `specs/001-manage-bookmarks/spec.md`

**Note**: This template is filled in by the `$speckit-plan` command; its definition describes the execution workflow.

## Summary

Build a personal web application that saves bookmarks from a pasted URL, safely retrieves editable page metadata, detects duplicates, supports composable text/tag search, and maintains a read-later queue. A React client will use a Fastify JSON API in one Node.js process. SQLite will persist the single-user library. Metadata fetching is isolated behind strict public-network, redirect, content, size, and time controls; search input is parsed into a typed expression before parameterized database queries are produced.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x on Node.js 24 LTS; HTML and CSS for the client

**Primary Dependencies**: React 19.3, Vite 8, Fastify 5, Zod, Cheerio

**Storage**: File-backed SQLite through Node's built-in `node:sqlite`, with numbered SQL migrations

**Testing**: Vitest, React Testing Library, Fastify request injection, and Playwright 1.61.0

**Target Platform**: Linux-hosted web application; current desktop and mobile browsers

**Project Type**: Single-package web application with browser client and server API

**Performance Goals**: Search/filter/sort 1,000 bookmarks within 1 second for at least 95% of attempts; return published metadata for at least 90% of eligible pages within 5 seconds

**Constraints**: Listen on `0.0.0.0:4000`; one prepared foreground start command; no authentication in v1; metadata requests must not reach non-public networks; metadata failure cannot block bookmark saving; keyboard and assistive-technology access for all core flows

**Scale/Scope**: One user, approximately 1,000 bookmarks, one library screen plus save/edit dialogs and focused library views

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is still an unratified placeholder and contributes no enforceable technical constraints. The repository-level SDD rules therefore provide the active gates:

- PASS: The specification is written, validated, and explicitly approved.
- PASS: This phase creates design artifacts only; tasks and implementation remain gated.
- PASS: Each planned component traces to an approved requirement or to safe operation of that requirement.
- PASS (post-design): Data model, interface contracts, and validation guide cover metadata fallback, duplicate detection, combined search, read-later state, persistence, and accessibility.
- PASS (post-design): No design choice changes the approved product scope. No exception requires complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-bookmarks/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/           # Phase 1 output ($speckit-plan command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── client/
│   ├── components/
│   ├── features/
│   │   ├── bookmarks/
│   │   ├── read-later/
│   │   └── search/
│   ├── api/
│   ├── styles/
│   └── main.tsx
├── server/
│   ├── api/
│   ├── db/
│   │   └── migrations/
│   ├── metadata/
│   ├── repositories/
│   ├── search/
│   ├── services/
│   └── server.ts
└── shared/
    ├── contracts/
    └── search/

tests/
├── e2e/
├── fixtures/
├── integration/
└── unit/

data/
└── bookmarks.sqlite       # runtime-created and ignored
```

**Structure Decision**: Use one npm package and one production process. Fastify serves `/api/*` and the Vite-built client, so the final application has one installation, database, port, and start command. Client, server, and shared validation/search contracts remain separate source areas to prevent browser code from acquiring network or persistence responsibilities. No complexity exceptions are required.
