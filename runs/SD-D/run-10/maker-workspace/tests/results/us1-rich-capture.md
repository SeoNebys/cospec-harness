# User Story 1 — rich capture evidence

Recorded 2026-09-18 in the shared Linux/Chromium review environment.

## Automated acceptance runs

- `npm run test:e2e`: 4/4 journeys passed across desktop Chromium and a Pixel 7 viewport.
- The metadata proposal assertion is timed from URL entry until the retrieved title appears and must remain below 3,000 ms. The controlled runs passed on both viewports.
- The unavailable-page journey is timed from page entry through the persisted detail view and must remain below 45,000 ms. Both controlled runs passed, with no entered title or note lost.
- Each Playwright run attaches its exact timing as `metadata-timing.json` or `manual-fallback-timing.json` in the HTML report.

## Supporting checks

- A live safe-fetch/extraction smoke check against `https://example.com` completed in 0.9 seconds wall time and extracted the real `Example Domain` HTML title.
- A live full metadata/media capture against `https://www.nasa.gov/` completed in 1.3 seconds wall time and returned the real title and description plus locally cached favicon and preview-image assets with no warnings.
- Unit coverage verifies Open Graph precedence, HTML fallbacks, relative media URLs, final redirect URLs, timeout fallback, private IPv4/IPv6 rejection, mixed DNS-answer rejection, per-hop redirect validation, redirect limits, response byte limits, timeouts, credentials, ports, and MIME rejection.
- Contract/integration coverage verifies per-user access, duplicate normalization, authenticated media delivery, restart persistence, and compensating rollback when a later media promotion fails.

## Interpretation

These runs provide deterministic threshold and failure-path evidence for the milestone. They do not by themselves establish the specification's population-level 90%/95% usability rates; those require a representative public-page corpus and first-time-user study before a production launch claim.
