# Implementation Plan: Manage Bookmarks

**Branch**: `001-manage-bookmarks` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-manage-bookmarks/spec.md`

## Summary

A single-user, single-device desktop application for saving and managing web
bookmarks. When the user saves an address, the app auto-fetches the page's
title, description, and favicon, and — at that moment — captures a readable copy
of the article (or retains the PDF itself), so saved content survives even if
the original page later changes or disappears. Everything is stored locally on
the user's device: no accounts, no sign-in, no cloud sync. The app supports
personal formatted notes, tags with reuse suggestions, powerful search (keyword,
exact phrase, tag-scoped, saved searches), batch actions, archive/restore vs.
permanent delete, read-later triage, custom sorting, and import/export in the
standard browser bookmarks format.

**Technical approach**: A cross-platform desktop app (runs on macOS, Windows,
and Linux) built with a web-technology UI wrapped in a desktop shell. All data
lives in a local embedded database plus a local files folder for saved page
copies and PDFs. Page fetching, readable-content extraction, and favicon/PDF
capture run in the background so the interface never freezes.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20 LTS runtime inside the desktop shell)

**Primary Dependencies**:
- **Electron** — desktop shell producing installable macOS/Windows/Linux apps from one codebase
- **React** + **Vite** — user interface
- **better-sqlite3** — embedded local database (with FTS5 full-text search)
- **@mozilla/readability** + **jsdom** — extract the readable article content for the saved copy (the same engine behind browser "reader mode")
- **DOMPurify** — sanitize captured HTML and user note HTML before storing/displaying
- A rich-text editor component (e.g. **TipTap**) — formatted personal notes (bold, lists, links)
- Standard `fetch` (built into Node 20) — retrieve pages, favicons, and PDFs

**Storage**:
- **SQLite database file** (bookmarks, tags, saved searches, settings, and a full-text search index) in the app's per-user data directory
- **Local files folder** alongside it for saved copies: extracted article HTML per bookmark, and retained PDF files

**Testing**: **Vitest** (unit + integration of the core logic) and **Playwright** (end-to-end UI flows against the built app)

**Target Platform**: Desktop — macOS, Windows, Linux (single installable app per platform)

**Project Type**: Desktop application (single project, main/renderer process split)

**Performance Goals**:
- Collection list, search, and filters feel instant (results < 200 ms) with 1,000+ bookmarks (SC-010)
- Saving a bookmark returns control to the user immediately; metadata + copy capture complete in the background
- Import of 500+ entries stays responsive with visible progress (SC-007)

**Constraints**:
- Fully offline-capable for all stored data and saved copies (only fetching new/live content needs network) (SC-003, SC-009)
- All data stays on-device; nothing is transmitted to any server (privacy: single-user assumption)
- Exactly one bookmark per address enforced at the storage layer (SC-011)

**Scale/Scope**: One user; target tens of thousands of bookmarks; ~8 primary screens/views
(collection, bookmark detail/edit, saved-copy reader, archived view, search/saved-searches,
import/export, settings, add-bookmark).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unratified
template with placeholder principles only — there are **no binding project
principles to gate against**. Default engineering discipline is therefore
applied:

- **Simplicity / YAGNI**: Single project, single local database, no server, no
  network services beyond fetching the pages the user bookmarks. ✅ No violation.
- **Scope discipline**: Plan implements exactly the approved spec (v1 scope);
  out-of-scope items (pixel-faithful snapshots, accounts, sync) are excluded. ✅
- **Testability**: Core logic (save, dedupe, capture, search, import/export) is
  separated from UI so it can be unit/integration tested headlessly. ✅

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-bookmarks/
├── plan.md              # This file
├── research.md          # Phase 0 output — technology & approach decisions
├── data-model.md        # Phase 1 output — entities, fields, relationships, rules
├── quickstart.md        # Phase 1 output — how to run & validate the app
├── contracts/           # Phase 1 output — internal operation contracts (UI ↔ core)
│   ├── bookmark-operations.md
│   ├── search-operations.md
│   ├── capture-operations.md
│   └── import-export-operations.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (already complete)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── main/                       # Desktop "backend" process (has file + network access)
│   ├── index.ts                # App entry, window lifecycle
│   ├── ipc.ts                  # Bridge exposing core operations to the UI
│   ├── db/
│   │   ├── connection.ts       # Opens the local SQLite file
│   │   ├── schema.ts           # Tables + FTS index definitions
│   │   └── migrations/         # Schema versioning
│   ├── services/
│   │   ├── bookmarks.ts        # Create/edit/delete/archive, one-per-address dedupe
│   │   ├── metadata.ts         # Fetch title/description/favicon
│   │   ├── capture.ts          # Readable-copy extraction + PDF retention
│   │   ├── search.ts           # Keyword/phrase/tag-scoped queries + saved searches
│   │   ├── tags.ts             # Tag assignment + reuse suggestions
│   │   ├── batch.ts            # Batch actions over selections/result sets
│   │   └── importExport.ts     # Browser-bookmarks import + export
│   └── storage/
│       └── files.ts            # Read/write saved-copy HTML and PDF files
├── shared/                     # Types/contracts shared between processes
│   └── types.ts
└── renderer/                   # User interface (React)
    ├── main.tsx
    ├── views/                  # Collection, Detail, Reader, Archived, Search, ImportExport, Settings
    ├── components/             # BookmarkList, TagInput, NoteEditor, BatchToolbar, etc.
    └── state/                  # UI state, remembered sort order, current filter

tests/
├── unit/                       # Services in isolation (dedupe, search parsing, import mapping)
├── integration/                # Service + real SQLite (search, import/export round-trip)
└── e2e/                        # Playwright flows against the built app
```

**Structure Decision**: Single desktop-application project using the standard
Electron **main / renderer** split. The **main** process owns all file/network
access and the SQLite database and exposes a small set of named operations
(the "contracts") to the **renderer** (UI) over the IPC bridge. This keeps all
business logic (saving, dedupe, capture, search, import/export) in testable
service modules independent of the UI, satisfying the testability default above.

## Complexity Tracking

> No constitution violations; this section intentionally left empty.
