# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, private, browser-based app to save and manage bookmarks. On save
it captures page metadata (title, description, site icon, preview image),
prevents duplicates via light URL normalization, and preserves a full-page
single-file local copy (MHTML) — or the original PDF for PDF links — plus offers
an Internet Archive snapshot link. Bookmarks carry flexible tags (with reuse
suggestions), a Markdown note, and read/archived states. A readable list supports
a rich search language (`#tag`, quoted phrases, AND/OR/NOT with parentheses,
quoted operators treated literally), sorting, saved reusable filters, a read-later
view, an archive view, and bulk actions that respect the current search/filter.
Import/export uses the standard browser bookmark HTML format with the `TAGS`
attribute. Display preferences (default sort, page size, text size) persist.

**Technical approach**: One Node.js/TypeScript service (Express) exposes a REST
API and serves a React (Vite) single-page frontend. Data lives in a local SQLite
database (with FTS5 for text search); preserved copies are files on disk
referenced from the database. Page metadata and full-page capture use the
pre-installed Playwright 1.61.0 + Chromium (CDP `Page.captureSnapshot` → MHTML).
A custom recursive-descent parser turns the search expression into a boolean AST
evaluated against SQLite. The server listens on `0.0.0.0:4000` and `npm start`
launches the prepared build for review.

## Technical Context

**Language/Version**: TypeScript on Node.js 24 (image-provided).

**Primary Dependencies**:
- Backend: Express (HTTP/REST), better-sqlite3 (embedded SQLite + FTS5),
  Playwright 1.61.0 (metadata + MHTML/PDF capture, shared Chromium at
  `/opt/playwright-browsers`), node-html-parser (Netscape bookmark & metadata
  parsing).
- Frontend: React + Vite, react-router, markdown-it + DOMPurify (safe Markdown
  note rendering).
- Shared: Zod (request/response validation).

**Storage**: SQLite database file under `data/` (bookmarks, tags, saved filters,
preferences, FTS index). Preserved copies (`.mhtml` / `.pdf`) stored as files
under `data/captures/`, referenced by path from the database.

**Testing**: Vitest (unit: search parser, URL normalization, import/export,
merge logic); Playwright Test 1.61.0 (end-to-end user journeys).

**Target Platform**: Modern desktop browser (Chromium-class) reaching the app at
`http://maker:4000`; server runs in the shared Linux container.

**Project Type**: Web application (single service serving API + built SPA).

**Performance Goals**: Find a bookmark within a 1,000+ collection in under 10s
(SC-002); list and search interactions feel instant (<1s) at that scale.

**Constraints**:
- Server binds `0.0.0.0`, port `4000` (final app); `npm start` starts the
  prepared build only (build/install done beforehand).
- Metadata fetch, full-page capture, and Internet Archive lookups are
  best-effort and MUST NOT block saving; failures are recorded and surfaced.
- Full-page local copies are capped (default **25 MB**); larger pages are
  bookmarked with the local copy marked unavailable.
- Markdown notes rendered without executing embedded active content.
- Internet Archive and live page fetching require outbound internet; when
  unreachable, the app degrades gracefully and reports the gap honestly.

**Scale/Scope**: Single user; target smooth operation at 1,000–10,000 bookmarks;
14 user stories, 34 functional requirements, 5 entities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified
template containing only placeholders — it defines **no binding principles or
gates**. There are therefore no constitutional constraints to violate.

Applied general engineering defaults in their place:
- **Spec-first**: implementation derives from the approved spec; no code precedes
  this plan's approval.
- **Testable slices**: user stories are independently testable (per spec); tests
  target the risk-bearing logic (search parser, normalization, import/merge).
- **Simplicity**: a single service with an embedded database avoids unnecessary
  infrastructure (no external DB server, no separate frontend host).

**Result**: PASS (no gates defined). Re-checked after Phase 1 — still PASS; the
design introduces no complexity requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST + internal contracts)
│   ├── rest-api.md
│   ├── search-grammar.md
│   └── bookmark-html.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (existing)
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── index.ts             # Entry: builds app, listens on 0.0.0.0:4000
│   ├── app.ts               # Express app: API routes + static SPA + health
│   ├── config.ts            # Ports, paths, capture size limit
│   ├── db/
│   │   ├── connection.ts     # better-sqlite3 handle
│   │   ├── schema.sql        # Tables + FTS5 virtual table + triggers
│   │   └── migrate.ts        # Apply schema/migrations on startup
│   ├── models/               # Data access: bookmarks, tags, filters, prefs
│   ├── search/
│   │   ├── tokenizer.ts       # Handles quotes, #tag, operators, parens
│   │   ├── parser.ts          # Recursive-descent → boolean AST
│   │   └── evaluator.ts       # AST → SQL predicate over FTS + tag joins
│   ├── services/
│   │   ├── metadata.ts        # Fetch title/description/icon/preview
│   │   ├── capture.ts         # Playwright MHTML / PDF preservation
│   │   ├── archiveorg.ts      # Internet Archive availability + save request
│   │   ├── normalizeUrl.ts    # Light duplicate normalization
│   │   ├── importer.ts        # Netscape HTML → bookmarks (merge logic)
│   │   └── exporter.ts        # Bookmarks → Netscape HTML (TAGS attribute)
│   └── routes/               # REST handlers (see contracts/rest-api.md)
└── tests/
    ├── unit/                 # parser, normalizeUrl, importer/exporter, merge
    └── integration/          # route-level API tests against a temp DB

web/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── api/                  # typed REST client
│   ├── components/           # BookmarkCard, TagInput (suggestions),
│   │                         #   SearchBar, BulkActionBar, SavedFilterList, …
│   ├── pages/                # AllView, ReadLaterView, ArchiveView, Settings
│   └── lib/                  # markdown render + sanitize
└── tests/                    # component tests (Vitest + Testing Library)

tests/
└── e2e/                      # Playwright end-to-end journeys (1.61.0)

data/                         # runtime: bookmarks.db + captures/ (gitignored)
```

**Structure Decision**: Single web-application service. `server/` owns the REST
API, SQLite storage, capture/metadata/import-export logic, and also serves the
compiled `web/` SPA as static assets — so one `npm start` satisfies the review
harness on port 4000. Frontend and backend share TypeScript types for entities
and API contracts. This keeps deployment to a single process with an embedded
database, which fits the single-user, private scope without external services.

## Complexity Tracking

> No constitution gate violations. No entries required.
