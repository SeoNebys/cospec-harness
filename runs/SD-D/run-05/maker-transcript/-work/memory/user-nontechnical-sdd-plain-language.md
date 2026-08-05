---
name: user-nontechnical-sdd-plain-language
description: "How this client wants to collaborate — non-technical, plain language, spec-first with review at every gate"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5606fc8b-bd62-469f-afa4-54a2d7ff3544
---

The client on the bookmarks project is **non-technical** and explicitly values:
plain-language explanations (no jargon), and confirming with them at each
Spec-Driven Development gate (spec → plan → tasks → implement) rather than
guessing or running ahead.

**Why:** They said repeatedly that always knowing what they were getting — and
being asked at each gate — was what made the process work for them.

**How to apply:** Keep routing changes through the spec (this repo uses the
speckit skills; see CLAUDE.md). When a review comment implies new/changed
behaviour, write it into the spec as a rule before coding (past examples became
FR-023a archived-exclusion, FR-024 batch remove-tag, FR-028a import date
preservation). Explain plans/results in plain terms. Build incrementally and
pause for the client to try each slice. v1 is complete; parked v2 ideas
(cross-device sync, full-fidelity page snapshot, richer note editor) live in
specs/001-manage-bookmarks/spec.md and should start spec-first if picked up.
