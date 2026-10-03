# Requests recorded for later cycles

Per the experiment scope, cycle 1 runs one cycle through acceptance. Requests
that add or change scenarios beyond the current approved baseline are recorded
here without starting another cycle.

| ID | Source session | Request | Notes |
|----|----------------|---------|-------|
| LATER-001 | SESSION-001 | Ability to choose a different sort order for the library (beyond the newest-first default). | SUPERSEDED — client pulled sorting into cycle-1 exploration; now tracked in exploration-backlog.md item 1. |
| LATER-002 | SESSION-001 | Preserved page copies + Internet Archive submission — REAL implementation, deferred to its own cycle. | See detailed approved-experience spec below. Cycle 1 must NOT ship buttons implying real preservation. |

## LATER-002 — Preserved copies & Internet Archive (approved experience, deferred build)

The client approved the *intended behaviour* (via a simulated prototype); the
actual page storage and external-service connection are deferred to a dedicated
follow-up cycle because they require real content storage and archive.org.

Approved behaviour to build in that cycle:
- Both actions are **manual per-link** (never automatic for every saved link).
- "Save a copy": for a normal page, create a **self-contained local HTML file**
  of the page; for a **PDF address, store the original PDF** as-is.
- "Update copy": replace the existing preserved copy and update its date.
- "Send to Internet Archive": show the Internet Archive link **only after the
  service confirms a snapshot exists**.
- On failure of either operation: show a **clear error** and leave the bookmark
  otherwise **unchanged**.
- Cycle 1 must not present these buttons as functional preservation.
