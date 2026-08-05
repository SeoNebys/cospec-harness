---
name: bookmark-manager-client
description: Who the bookmark-manager client is and what they care about most
metadata: 
  node_type: memory
  type: user
  originSessionId: 03a7963e-fa1d-4d06-ad17-a78ecc5fb181
---

The client for the `specs/001-bookmark-manager` project is **non-technical**. They review
the spec/plan/tasks at each SDD gate in plain language (they don't read code) and steer via
reactions to a working build.

Priorities they've stressed repeatedly:
- **Simple everyday startup** — one action, no terminal/commands (drove FR-019 one-click launcher).
- **Data portability / no lock-in** — local-only storage, plus import AND export (folders→tags, dates preserved, full round-trip).
- **Incremental delivery** — build a slice, pause so they can try it, then continue.

How to apply: keep explanations jargon-free at the gates; when they flag something, route it
through the spec (see [[bookmark-manager-status]]), don't patch code ad hoc.
