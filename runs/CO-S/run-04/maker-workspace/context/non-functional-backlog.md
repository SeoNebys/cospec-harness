# Non-functional backlog & later-cycle requests

Recorded autonomously during Phase 1. Not part of cycle 1 implementation unless
otherwise approved. Deferred feature requests are also recorded here (not started
this trial, per experiment scope).

## Deferred feature requests (later cycles)
- **Cross-device sync / accounts.** Client wants the collection to follow them
  across devices (phone + laptop) eventually. Cycle 1 uses browser-local,
  single-user persistence (see SCN-012). Motivation: access the same collection
  anywhere.

## Non-functional notes
- **Scalability of the list / search.** Client values a scannable list and fast,
  reliable finding. With hundreds/thousands of bookmarks, list rendering and
  search should stay responsive (e.g. efficient filtering, possibly pagination
  or lazy rendering). Not yet quantified; revisit if volume grows.
- **UI polish.** Card layout, colours, and spacing were chosen by the
  facilitator during prototyping and approved functionally; visual refinement is
  a later concern, subordinate to the functional flows.

## Notes
- Markdown-in-notes rendering must stay safe (escape untrusted content before
  applying formatting) — a security/robustness concern for implementation.
