# Session log

## Cycle 1

- **Scenarios approved (Phase 1):** SCN-001 … SCN-018 (see scenarios-index.md).
- **Implementation:** `implementation/` — dependency-free Node.js server + SPA,
  JSON-file persistence, real page/PDF preservation, import/export, optional
  Internet Archive submission. Built fresh from approved GWT (not from prototype).
- **Verification (Phase 3):**
  - Internal unit/integration tests: `implementation/test/service.test.js` —
    15/15 passing (`npm test`).
  - Gherkin acceptance tests: `implementation/test/acceptance.py` — 26/26 checks
    passing across SCN-001…018 (browser-driven against the real server).
- **Acceptance (Phase 4):** presented on http://maker:4000 — awaiting client
  acceptance.

### Requirement changes / additions recorded for later cycles
See `context/later-cycle-requests.md`:
- L-01/L-10: manual re-capture / refresh of a saved copy on demand.
- L-08: (delivered in cycle 1 as preferences) — n/a.
- L-11: full-fidelity backup/restore (beyond browser-compatible export).
- Broader Markdown rendering in notes.
(These do not affect acceptance of the current approved scope.)
