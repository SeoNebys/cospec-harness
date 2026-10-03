# Non-functional backlog

Items recorded during Phase 1 to address later. These do not block the
functional flow.

| ID | Item | Source | Category | Notes |
|----|------|--------|----------|-------|
| NFR-001 | Comfortable to use from a phone (not just desktop) | Client, cycle 1 goal step | UI/UX responsiveness | Primary use is computer; phone used for quick look-up / saving. Prototype already wraps long content and stacks on narrow widths; confirm in real build. |
| NFR-002 | Fast load & smooth scrolling for very large collections (thousands) | Facilitator, boundary edge exploration | Performance/scalability | Prototype handles ~65 items fine; paging/virtualisation to be tuned during the build. |
| NFR-003 | The collection and preferences persist per personal account | Implied by goal + SCN-010 | Persistence/auth | Real app needs durable storage tied to the client's account (prototype uses in-memory + browser local storage as a stand-in). |
| NFR-004 | Auto-filled page details fetched from the actual page | SCN-001 assumption | Integration | Real app must retrieve title/description/site icon/thumbnail from the live page (prototype simulates locally). |
| NFR-005 | Real capture & storage of self-contained preserved page copies; Internet Archive submission | SCN-015 | Integration/storage | Prototype simulates snapshots. Build must fetch/store self-contained copies (and the actual PDF for PDF links) and submit to the Internet Archive on request. |
