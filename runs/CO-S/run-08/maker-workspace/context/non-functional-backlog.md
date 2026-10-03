# Non-functional backlog

Items observed during Phase 1 that are non-functional (quality/technical)
concerns rather than functional flows. Recorded for later; not blocking the
functional scope of cycle 1.

| # | Item | Source | Notes |
|---|------|--------|-------|
| NF-1 | Secure password storage (hashing) and safe session handling | SCN-011 sign-in | The functional flow requires sign-in; the strength/mechanism of credential storage and sessions is a security concern to decide at implementation. |
| NF-2 | Responsive layout for phone as well as laptop | Goal ("different devices"), SCN-011 | Client uses multiple device types; the UI should be usable on small screens. Not yet exercised as a functional scenario. |
| NF-3 | Performance with a large number of bookmarks | Edge-case exploration (boundary) | Live search/filter should stay responsive as the collection grows; specific targets not set. |
| NF-4 | Sync behaviour/latency across devices | SCN-011 | "Same links on every device" is functional; how fast changes propagate and offline behaviour are quality concerns to refine later. |

## Deferred / later-cycle requests

(None recorded yet.)
</content>
