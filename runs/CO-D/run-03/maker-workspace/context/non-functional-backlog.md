# Non-functional backlog

Recorded during Phase 1 facilitation (Cycle 1). These are quality attributes to
tune, not functional flows. They do not block the approved scenarios.

| # | Area | Note | Source |
|---|------|------|--------|
| NF-1 | Performance | Concrete response-time target for a large library (search, filter, sort, incremental load) to feel "fast". Behaviour is fixed by SCN-009; the speed target itself is to be tuned. | Client, discussing large libraries |
| NF-2 | Responsiveness | Must remain usable on a phone (responsive layout); no separate mobile app. | Goal statement |
| NF-3 | Data safety | Single-user personal data; deletion is the only destructive action and is confirmation-gated (SCN-005). Durable storage so nothing kept is lost. | Derived from archive/delete discussion |
| NF-4 | Storage growth | Automatic preserved copies (SCN-013) grow storage over time; capacity/retention strategy to be tuned. | Preserved-copy discussion |
| NF-5 | External service | Internet Archive is a third-party dependency (SCN-013/017): opt-in only, must handle slowness/outage gracefully with retry; never block core use. | Internet Archive discussion |
| NF-6 | Background work | Metadata fetch, copy capture, large bulk actions, and imports run in the background without freezing the app (SCN-009/012/013/017). | Multiple discussions |

No UI colour/size/animation preferences were expressed; the client focused on
behaviour. Update autonomously if such preferences emerge.
