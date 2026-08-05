# Session log

## SESSION-001 — Cycle 1 (2026-07-13)

### Summary
First cycle. Built a personal bookmark web app whose core purpose is not saving
links but being able to find them again and keep them organized as the pile grows.

### Phase notes
- Phase 1 (Facilitation): goal confirmed and recorded (context/goals.md).
  Interface: web app in the browser. Explored via incremental working prototypes
  (prototypes/p01..p07) with guided confirmation and alternative-comparison for
  the organization model (folders vs tags vs auto → tags) and tagging timing
  (before-save vs on-card vs after-save prompt → after-save) and delete style
  (confirm vs undo → undo).
- Phase 2 (Development): zero-dependency Node server + vanilla UI, shared logic
  module, JSON-file persistence. Internal info system: design-decisions.md,
  scenario-code-map.md.
- Phase 3 (Verification): 24/24 automated tests pass (9 Gherkin acceptance +
  unit/integration).
- Phase 4 (Acceptance): client ran all flows and accepted.

### Accepted scenarios (Cycle 1)
- SCN-001 Save a link by pasting it; capture the real page title (Happy Path)
- SCN-002 Find a saved link by typing; live filtering across title and site (Happy Path)
- SCN-003 Organize and browse by tags; a link can carry multiple labels (Happy Path)
- SCN-004 Tag a link via an in-the-moment prompt right after saving (Happy Path)
- SCN-005 Empty states — brand-new library and no search matches (Edge Case)
- SCN-006 Save-time problems — missing title, duplicate link, non-link input (Error Case)
- SCN-007 Saving while offline — save now, resolve title later (Edge Case)
- SCN-008 Delete a saved link instantly, with a brief Undo safety net (Happy Path)

### Acceptance result
APPROVED — all 8 scenarios accepted by the client.

### Deferred / backlog (see context/non-functional-backlog.md)
- NF-1 keep search fast at large scale; NF-2 storage/persistence approach.
- Out of scope this cycle: dead-link detection; bulk delete.
