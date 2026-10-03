# Bookmark Manager validation report

**Validated:** 2026-09-24  
**Runtime:** Node.js 24, SQLite WAL, Chromium/Playwright 1.61.0  
**Review endpoint:** `http://maker:4000/`

## Release outcome

The complete approved product scope is implemented: automatic metadata with editable fallbacks; unread/read-later state; smart Boolean, phrase, and tag search; reversible archive; individual and 500-item bulk maintenance; safe formatted notes; dynamic saved views; browser HTML import/export; persisted display preferences; rendered offline HTML copies; and byte-identical retained PDFs.

## Verified commands

| Check | Result |
|---|---|
| `npm ci` / dependency lock | Pass |
| `npm audit --audit-level=moderate` | Pass — 0 vulnerabilities |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm run migrate` | Pass |
| `npm run test:unit` | Pass — 5 files, 9 tests |
| `npm run test:integration` | Pass — 2 files, 3 tests |
| `npm run test:security` | Pass — 1 file, 5 blocked-network cases |
| `npm run test:performance` | Pass — 10,000-item search/interchange and 500-item bulk thresholds |
| `npm run test:e2e` | Pass — 9 browser journeys |
| Blob audit and SQLite foreign-key check | Pass |
| Backup to a new directory, restore, and audit | Pass |

Browser coverage verifies automatic details and edits, advanced search, read state, archive/restore, formatted notes, dynamic saved views, import/export, persistent preferences, sandboxed offline HTML, explicit recapture replacement, and exact PDF hashes. Visual baselines cover desktop and narrow layouts. The application exposes `data-harness-ready="true"` only after its initial collection load.

## Security and preservation checks

- Only public HTTP/HTTPS resources on standard ports are eligible for capture.
- Every DNS result is checked; the chosen public address is pinned for the request. Redirects and rendered-page subresources repeat the same validation.
- Browser rendering uses a fresh credential-free context with service workers, WebSockets, non-GET requests, popups, and downloads blocked.
- Stored HTML removes active content and remote dependencies, embeds bounded images, and is served with an empty iframe sandbox, restrictive CSP, `nosniff`, and immutable private caching.
- PDFs are stored and downloaded byte-for-byte; the browser test compares SHA-256 values with the source fixture.
- Permanent deletion warns about retained copies, cancels queued capture work, removes logical access transactionally, and schedules orphan cleanup.

## Scale results

Automated gates passed for search across 10,000 bookmarks in under one second and a 500-item bulk mutation in under five seconds. A 10,000-entry browser-format round trip retained every tested title and address. Collection responses are paginated, imports are bounded to 100 MiB/50,000 entries/depth 128, and capture concurrency and storage/resource quotas are configurable.

## Expected limitations

As stated in the approved plan, authenticated, DRM-protected, canvas-only, consent-gated, and highly interactive pages may yield a warning or a less faithful readable copy. Browser bookmark HTML is inherently lossy; the export screen requires acknowledgement that notes, tags, state, images, saved copies, saved views, and preferences are not represented. The runtime uses the browser's isolated built-in PDF renderer while keeping the original file available as an explicit download.
