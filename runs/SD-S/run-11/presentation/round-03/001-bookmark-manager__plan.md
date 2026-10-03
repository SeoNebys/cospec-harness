# Implementation Plan: Bookmark Manager

**Branch**: `[001-bookmark-manager]` (feature identifier; repository is not yet initialized) | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Approved feature specification from `specs/001-bookmark-manager/spec.md`

## Summary

Build a private, single-user bookmark web application as one Node.js service. A React interface will call a same-origin JSON API served by Express; bookmark and tag data will be persisted in an embedded SQLite database. Entering a valid public web address will start a separate, cancellable metadata-preview request that retrieves only bounded HTML page metadata. The save operation never depends on that request and always has a URL-title fallback. The interface will keep search/filter/sort state in the URL, use semantic responsive controls, and cover the approved save, find, organize, archive, restore, and delete flows.

## Technical Context

**Language/Version**: Node.js 24 LTS (minimum 24.15), TypeScript 7.x, React 19.x

**Primary Dependencies**: Express 5.x, Vite 8.x, Zod 4.x, Cheerio 1.x; browser platform APIs and Node built-ins for remaining behavior

**Storage**: Embedded SQLite through Node's built-in `node:sqlite`; numbered SQL migrations; one configurable database file

**Testing**: Node's built-in test runner for unit and integration tests; Playwright 1.61.0 for Chromium end-to-end testing; `@axe-core/playwright` for automated accessibility checks

**Target Platform**: Single Linux Node.js process listening on `0.0.0.0:4000`; modern evergreen desktop and mobile browsers down to a 320-pixel viewport

**Project Type**: Responsive single-page web application with a same-origin REST API

**Performance Goals**: Search, filter, and sort updates complete within one second for a 1,000-bookmark library in at least 95% of measured attempts; usable metadata appears within five seconds for at least 95% of eligible pages

**Constraints**: Saving must never wait on metadata retrieval; page fetching must resist SSRF and resource exhaustion; user edits must win over late metadata; keyboard-only operation and accessible names/statuses are mandatory; no accounts, collaboration, browser extension, or page-content archive

**Scale/Scope**: One private user, one application process, approximately 1,000 bookmarks, three persisted tables, one primary library screen plus dialogs/drawers and empty/error states

## Constitution Check

*GATE: Passed before research and re-checked after design.*

The constitution file is an unratified placeholder and contains no enforceable project principles. The active repository instructions therefore supply the applicable gates:

- The specification was approved by the client before this plan was created: **PASS**.
- This phase produces design artifacts only and does not implement product code: **PASS**.
- The plan will be presented for client approval before task generation or implementation: **PASS**.
- Runtime delivery is designed for `0.0.0.0:4000` and the required harness manifest, but that manifest is deferred until a runnable build exists: **PASS**.

Post-design review: the design remains within the approved specification, introduces no collaboration/authentication scope, and preserves non-blocking save behavior. No gate violations require justification.

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
│   ├── openapi.yaml
│   └── ui-contract.md
└── tasks.md                 # Created only in the next phase
```

### Source Code (repository root)

```text
package.json
package-lock.json
tsconfig.json
vite.config.ts
index.html

src/
├── client/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   ├── components/
│   ├── hooks/
│   └── styles/
├── server/
│   ├── index.ts
│   ├── app.ts
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   ├── metadata/
│   └── db/
└── shared/
    ├── schemas/
    ├── types/
    └── url/

migrations/
└── 001_initial.sql

data/                         # Runtime database; ignored by version control

tests/
├── unit/
├── integration/
├── fixtures/
└── e2e/
```

**Structure Decision**: Use one npm package and one production process. Vite builds the React client into static assets; Express serves those assets and the `/api` routes. Shared schemas and URL rules prevent client/server contract drift, while server-only database and network code remain inaccessible to the browser bundle. This is smaller than a multi-package or full-stack-rendering framework layout and fits a one-screen private application.

## Implementation Strategy

### 1. Application foundation

- Create the TypeScript, Vite, React, and Express build with a production `npm start` command that listens on `0.0.0.0:4000`.
- Add shared Zod request/response schemas, normalized error responses, security headers, same-origin checks for state-changing requests, and a JSON body-size limit.
- Add numbered startup migrations and configure the SQLite path through `BOOKMARK_DATA_DIR`, defaulting to `data/`.

### 2. Bookmark domain and persistence

- Implement URL parsing/canonical comparison in one shared module.
- Implement transaction-safe repositories for bookmarks, tags, and bookmark-tag relationships using prepared statements.
- Keep active/archive state explicit, delete orphan tags after writes, and map duplicate canonical addresses to a `409` response containing the existing bookmark identifier.
- Apply search, tag/favorite filtering, and supported sorting in the service layer over the bounded one-user collection; preserve Unicode-friendly normalized comparisons without relying on SQLite's limited default case folding.

### 3. Safe metadata preview

- Start metadata lookup from the client after a valid URL is entered, using an abort controller and request generation token; Save remains enabled throughout.
- On the server, accept only HTTP/HTTPS destinations without embedded credentials and fetch only ports 80/443.
- Resolve and validate all IPv4/IPv6 answers, reject special/private destinations, pin the approved address to the connection, and revalidate every manually followed redirect.
- Enforce a four-second total deadline, no more than five redirects, HTML/XHTML content types, and a one-megabyte decoded response limit; stop after the document head when possible.
- Parse without executing scripts or loading subresources. Extract a plain-text title from `<title>`, then Open Graph/Twitter fallbacks; extract a description from Open Graph, standard description, then Twitter metadata. Normalize whitespace/control characters and cap to field limits.
- Return `available`, `partial`, or `unavailable` without exposing sensitive network detail. The client updates only untouched fields belonging to the latest URL request.

### 4. Responsive accessible interface

- Build one library screen with save form, search, visible active filters, sort control, active/archive switch, bookmark cards/list rows, and actionable empty states.
- Represent search, filters, sort, and active/archive view in URL search parameters so opening/closing details and browser history do not lose library state.
- Use a labeled modal or drawer for editing and a focused confirmation dialog for deletion; restore focus after closing.
- Open bookmark destinations in a new browsing context with opener isolation so the current library state remains intact.
- Announce metadata loading/success/failure and validation results through appropriate live status text, while keeping all workflows keyboard operable.

### 5. Verification and delivery

- Cover pure URL, validation, metadata-extraction, dirty-field, filter/sort, and state-transition behavior with unit tests.
- Cover SQLite persistence, migrations, API contracts, duplicate races, and metadata network-policy outcomes with integration tests using temporary databases and injected network dependencies.
- Cover the three prioritized user stories in Chromium at desktop and 320-pixel widths with Playwright, including failure/empty states, persistence, 1,000-record responsiveness, keyboard operation, and axe scans.
- Build before delivery, create `.harness/app.json` with `npm start`, verify the ready marker only appears after initial data loading, and smoke-test `http://127.0.0.1:4000`.

## Design Traceability

| Approved requirement area | Design coverage | Verification |
|---|---|---|
| Save, validation, automatic details, editable values, fallback (FR-001–FR-006) | Shared URL/schema rules, independent metadata-preview endpoint, dirty-field/request-generation client state, server fallback | Unit metadata/URL tests, integration network-policy tests, E2E success/late/failure save flows |
| Persistence, display, open, and edit (FR-007–FR-010) | SQLite repositories, bookmark response model, isolated external links, edit dialog | Repository reopen tests and E2E persistence/open/edit flow |
| Search, filters, sorting, duplicates (FR-011–FR-014) | Service-layer normalized query, URL view state, canonical unique key and `409` contract | Unit query matrix, integration duplicate race, E2E combined filters and sorts |
| Archive, restore, delete, empty states (FR-015–FR-017) | Explicit archive/restore operations, confirmed DELETE UI contract, state-specific empty views | API integration tests and complete maintenance E2E flow |
| Preserved state, responsive use, accessibility (FR-018–FR-020) | URL search parameters, responsive semantic UI, focus/status contract | Back/Forward tests, 320-pixel run, keyboard checks, axe scans, manual zoom/screen-reader checklist |
| Measurable outcomes (SC-001–SC-009) | Quickstart acceptance scenarios and deterministic fixture strategy | Timed first-save/find/1,000-record/metadata checks plus destructive-action, viewport, keyboard, and usability evidence |

## Complexity Tracking

No constitution violations or exceptional complexity are present. The server-side metadata boundary is necessary to satisfy automatic page details despite browser cross-origin limits, and its security controls are required because it processes user-supplied destinations.
