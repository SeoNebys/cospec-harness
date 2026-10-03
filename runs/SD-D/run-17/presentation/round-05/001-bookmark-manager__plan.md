# Implementation Plan: Bookmark Manager

**Branch**: `001-bookmark-manager` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bookmark-manager/spec.md`

## Summary

A single-user, web-based bookmark manager. The user saves URLs; the app fetches
page metadata (title, description, favicon, preview image), lets them add
Markdown notes and tags, and organizes items with an expressive search grammar,
read-later/archive states, bulk actions, sorting, and saved filters. It imports
and exports standard browser bookmark HTML, and preserves pages as self-contained
single-file local copies (PDFs kept as PDFs) with an optional Internet Archive
submission.

Technical approach: a Node.js web application (Express HTTP server) with a
server-rendered + progressive frontend, an embedded SQLite database for
persistence, Playwright/Chromium (already in the image) for metadata capture and
single-file page/PDF preservation, and a hand-written search-query parser that
implements the spec's boolean/`#tag`/phrase semantics. The server listens on
`0.0.0.0:4000` and is started with `npm start`.

## Technical Context

**Language/Version**: Node.js 24 (JavaScript, ES modules)

**Primary Dependencies**:
- `express` — HTTP server and routing (listens on `0.0.0.0:4000`)
- `better-sqlite3` — embedded, synchronous SQLite storage (no external DB server)
- `playwright` (pinned `1.61.0`) + shared Chromium at `/opt/playwright-browsers`
  — page rendering for metadata, single-file HTML capture, and PDF generation
- `cheerio` — parse fetched HTML for metadata and parse/generate Netscape
  bookmark HTML for import/export
- `marked` + `dompurify` (with `jsdom`) — render and sanitize Markdown notes
- Frontend: server-rendered HTML templates plus vanilla JS modules (no heavy SPA
  framework); a small client bundle for interactivity (search box, multi-select,
  tag suggestions)

**Storage**: SQLite database file under `data/` (e.g., `data/bookmarks.db`);
preserved page copies stored as files under `data/pagecopies/` referenced by row

**Testing**: Node built-in test runner (`node --test`) for unit tests
(query parser, metadata extraction, import/export round-trip); Playwright Test
(pinned `1.61.0`) for end-to-end browser checks of the key user journeys

**Target Platform**: Linux server (container), reached by the client at
`http://maker:4000`; modern desktop browser client

**Project Type**: Web application (single deployable Node service serving both API
and UI)

**Performance Goals**: Search (including compound queries) feels instant for
500+ bookmarks (< ~200 ms server-side); list/sort operations comparably fast

**Constraints**: Must listen on `0.0.0.0:4000`; started via `npm start`; HTTP
sessions/cookies must work in the review environment; preserved copies must open
offline; external steps (metadata fetch, Internet Archive) must fail gracefully
without harming the bookmark

**Scale/Scope**: Single user; low thousands of bookmarks; 13 user stories / 25+
functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an unfilled
template with no ratified principles. There are therefore no constitutional gates
to enforce. Default engineering guidance is followed: keep the design simple
(single deployable, embedded DB), prefer the tools already provided by the image
(Playwright/Chromium, Node 24), and pin `playwright` to `1.61.0` to match the
installed browser revision. No violations to justify; Complexity Tracking left
empty. **Gate: PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/001-bookmark-manager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (HTTP API + search grammar)
│   ├── api.md
│   └── search-grammar.md
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # From /speckit-tasks (later gate)
```

### Source Code (repository root)

```text
package.json             # scripts: "start" -> node src/server.js; deps pinned
package-lock.json        # preserved lockfile
data/                    # SQLite db + preserved page copies (gitignored content)
├── bookmarks.db
└── pagecopies/

src/
├── server.js            # Express app bootstrap; listens on 0.0.0.0:4000
├── db/
│   ├── index.js         # better-sqlite3 connection + migrations runner
│   └── migrations/      # schema (bookmarks, tags, bookmark_tags, saved_filters, prefs)
├── models/              # data access: bookmarks, tags, filters, preferences
├── services/
│   ├── metadata.js      # fetch title/description/favicon/preview (Playwright/cheerio)
│   ├── search.js        # query parser + evaluator (boolean/#tag/phrase)
│   ├── pagecopy.js      # single-file HTML capture + PDF preservation (Playwright)
│   ├── archiveorg.js    # Internet Archive submission
│   ├── porthtml.js      # Netscape bookmark HTML import/export
│   └── notes.js         # Markdown render + sanitize
├── routes/              # Express routers: bookmarks, tags, filters, prefs, io, views
└── public/              # static assets + client JS (search, multi-select, tag suggest)
    └── js/

tests/
├── unit/                # search parser, metadata, import/export round-trip, notes
└── e2e/                 # Playwright: save, search, read-later, archive, bulk, io

.harness/
└── app.json            # {"kind":"application","port":4000,...} for review
```

**Structure Decision**: Single Node web-application project (one deployable
service serving both the JSON API and the server-rendered UI). This matches the
single-user scope and the runtime requirement of one `npm start` process on port
4000, and avoids the overhead of a separate frontend build/service. Directories
above are the concrete layout used by tasks.

## Complexity Tracking

> No constitution violations; section intentionally empty.
