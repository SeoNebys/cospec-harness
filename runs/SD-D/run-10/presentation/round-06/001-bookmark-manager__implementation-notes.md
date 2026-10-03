# Implementation notes

The approved v1 specification is implemented without browser import/export or saved page snapshots; both remain explicitly deferred.

Tags are the primary many-to-many organizer. Collections remain optional and single-valued. Tag browsing uses the stable owned tag ID as a structured include filter, including for tag names containing spaces. Searches and all-match bulk operations share the same parsed SearchCriteria path.

Metadata retrieval is bounded and SSRF-protected, while capture failures never block manual saving. Archived rows remain in duplicate detection. Permanent deletion is separately confirmed. Attached media becomes eligible for grace-period cleanup only after it is no longer referenced.

Operational validation includes migration-before-readiness, SQLite/search-index/filesystem checks, periodic idempotent cleanup, security headers and throttling, graceful shutdown, and documented database-plus-assets backup/restore procedures.

## Final reconciliation

Every approved functional requirement is represented in the implementation and acceptance coverage: FR-001–FR-015 by account/rich-capture behavior, FR-016–FR-031 by reading state and tag-first organization, FR-032–FR-041 by archive/delete and precise search, FR-042–FR-050 by saved searches and bulk actions, and FR-051–FR-058 by privacy, concurrency, accessibility, responsive behavior, and operations. The corresponding SC evidence is recorded in `tests/results/us1-rich-capture.md` through `tests/results/us8-privacy.md` and `tests/results/final-validation.md`.

The eight quickstart acceptance walkthroughs were executed through the story-specific and full-acceptance Playwright suites in both configured desktop and phone projects. The final run passed all 22 cases. Clean installation, static analysis, unit, integration/security, contract, scale, build, startup, readiness, review-login, and shared-network checks also passed.

There are no approved v1 behavioral deviations. Browser bookmark import/export and stored page-content snapshots remain deferred exactly as agreed. Population-level usability percentages still require a representative first-time-user study; deterministic timing thresholds and all automated functional checks pass, but they are not presented as a substitute for that study.
