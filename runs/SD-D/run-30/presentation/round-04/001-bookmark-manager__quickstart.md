# Quickstart and Validation Guide

This guide defines how the completed implementation will be run and checked. Commands become executable during implementation; no application code exists at the plan gate.

## Prerequisites

- Node.js 24 and npm
- Chromium from `/opt/playwright-browsers`
- A writable application-data directory

## Setup and run

```bash
npm ci
npm run build
npm run db:migrate
npm test
npm run test:e2e
npm start
```

The prepared application must listen on `0.0.0.0:4000`. Client review uses `http://maker:4000/`; browser automation uses `http://127.0.0.1:4000/`.

## Validation scenarios

### 1. Enriched save and duplicate routing

1. Submit a controlled public fixture URL and confirm retrieved title/media appear.
2. Edit the title, save, reload, and verify persistence.
3. Submit the same destination with scheme/host letter-case differences; confirm the existing item opens and count does not increase.
4. Submit a different path or query on the same site and confirm it saves separately.

### 2. Metadata fallback and fetch security

1. Test timeout, oversized HTML, missing title, inaccessible image, redirect loop, and unsupported content fixtures.
2. Confirm manual title fallback and that missing imagery never blocks saving.
3. Test loopback, private, link-local, encoded-IP, DNS-rebinding, and redirect-to-private targets.
4. Confirm every unsafe request is refused and none reaches the protected fixture.

### 3. Search language

1. Seed examples from `contracts/search-grammar.md`.
2. Verify implicit AND, exact `#tag`, quoted phrase order, and OR/NOT precedence.
3. Verify negative-only queries evaluate across the selected view.
4. Enter unmatched quotes, missing operands, and parentheses; confirm precise errors without clearing input.

### 4. Reading, favorite, and archive independence

1. Favorite a bookmark and add it to read later.
2. Mark it read, unread, then remove it from read later; verify favorite remains unchanged.
3. Archive an unread item and verify it leaves active/unread views but retains state.
4. Restore it and verify it returns to applicable views.

### 5. Formatted notes

1. Add a heading, link, ordered list, and unordered list; save and verify rendering.
2. Edit again and confirm source content survives.
3. Enter script markup, event attributes, unsafe link protocols, and active embeds; confirm none executes or creates an unsafe link.

### 6. Persistence, deletion, and empty states

1. Restart and verify bookmark fields, tags, media, and states persist.
2. Cancel deletion, then confirm deletion; verify the bookmark and dependent records are removed appropriately.
3. Verify empty collection and zero-result search have distinct explanations and recovery actions.

### 7. Accessibility and scale

1. Complete all primary journeys with keyboard only.
2. Verify visible focus, accessible names, dialog focus behavior, and async announcements.
3. Seed 10,000 bookmarks and measure list/search/filter/sort/state updates against the one-second target.

## References

- HTTP API: `contracts/openapi.yaml`
- Search semantics: `contracts/search-grammar.md`
- Persistence/state rules: `data-model.md`

## Review readiness

After implementation and validation, create `.harness/app.json` with the production start command and verify `data-harness-ready="true"` appears only after the initial usable UI and data state load.
