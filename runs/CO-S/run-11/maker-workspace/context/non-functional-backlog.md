# Non-functional backlog

Recorded during Phase 1. Not part of the cycle-1 functional scope unless noted;
revisit in later cycles.

| # | Item | Source | Notes |
|---|------|--------|-------|
| NF-1 | Performance with many bookmarks (hundreds+) | Edge-case exploration (boundary) | Live search and list rendering should stay responsive as the collection grows. Confirm acceptable behaviour later; not blocking cycle 1. |
| NF-2 | Password/account security | Derived from SCN-013 | Passwords must be stored securely (hashed, not plain text); use a proper session mechanism. Implementation-level requirement for the sign-in feature. |
| NF-3 | Cross-device sync latency | Derived from SCN-013 | Changes should appear on other devices within a reasonable time after sign-in/refresh. |

## Notes
- The client repeatedly emphasised speed of retrieval; keep search responsive
  (functional expectation folded into SCN-004; performance-at-scale tracked as
  NF-1).
