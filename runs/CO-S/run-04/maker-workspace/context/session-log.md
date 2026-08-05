# Session log

## SESSION-001 — Cycle 1

- **Date:** 2026-07-14
- **Cycle:** 1
- **Interface form:** Web app (desktop browser)
- **Goal:** One trusted spot to drop a link and actually find it again
  (see context/goals.md).

### Accepted scenarios
| ID | Title | Type | Result |
|----|-------|------|--------|
| SCN-001 | Save a link and see it land in one place with a readable name | Happy Path | approved |
| SCN-002 | Open a saved link, and rename its name in place | Happy Path | approved |
| SCN-003 | Find a saved link again — browse the list or search | Happy Path | approved |
| SCN-004 | Remove a saved link, with Undo | Happy Path | approved |
| SCN-005 | First-time / empty state | Edge Case | approved |
| SCN-006 | Saving a link whose page name cannot be found | Edge Case | approved |
| SCN-007 | Saving something that is not a web link | Edge Case | approved |
| SCN-008 | Saving a link that is already saved (duplicate) | Edge Case | approved |
| SCN-009 | Saved links persist across sessions | Edge Case | approved |

### Acceptance result
**Approved** — client walked through all nine scenarios in the running app and
confirmed each matches intent, including persistence across a refresh.

### Verification
All 32 automated tests pass (unit + integration/acceptance). Live page-name
lookup confirmed working; graceful fallback when offline.

### Deferred (non-functional backlog)
- NF-1 cross-device access (client deprioritised)
- NF-2 performance with very large libraries
- NF-3 layout resilience for very long names/addresses

### Notes for later cycles
- Design decisions: implementation/docs/design-decisions.md
- Scenario→code mapping: implementation/docs/scenario-code-map.md
