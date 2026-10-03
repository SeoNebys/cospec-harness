# Session log

## SESSION-001 — Cycle 1

- Interface: personal bookmark manager, web app (responsive), single user.
- Facilitation produced 17 approved scenarios (SCN-001..017); see
  context/scenarios-index.md. Goal: context/goals.md.
- Implementation: `implementation/` (Node.js + Express + node:sqlite + vanilla-JS
  SPA). Design + scenario→code mapping: implementation/DESIGN.md.

### Verification (Phase 3)
- Internal + Gherkin acceptance tests: `npm test` → 45 passing
  (unit: normalize/query/bookmarksHtml/snapshot; integration: repo;
  acceptance: HTTP app; e2e: self-contained copy).
- Defect found & fixed during verification: select-all-matching bulk passed
  the archived scope as a string ('0') treated as truthy; fixed by coercion in
  `repo.scopeRows` (protects the real app's bulk path).

### Acceptance round 1 → correction (in-cycle, implementation error)
- Client rejected: preserved page copy referenced the live site for images/CSS,
  failing SCN-013's "genuinely self-contained, viewable if the source disappears".
- Fix: `lib/snapshot.js` inlines CSS/@import/url()/images/fonts as data: URIs and
  removes live scripts; wired into `lib/metadata.captureCopy`. Re-verified with an
  offline-origin end-to-end test. Scenario unchanged.

### Acceptance (Phase 4)
- Status: awaiting client acceptance.
- Accepted scenarios: (pending)
- Requirement changes/additions recorded for a later cycle:
  - LC-1 (context/later-cycle-requests.md): automatic dead-link detection.
- Non-functional backlog: context/non-functional-backlog.md (NF-1..NF-6).
