---
name: client-non-technical-sdd
description: "This client is non-technical and wants SDD changes routed through the spec, gate by gate"
metadata: 
  node_type: memory
  type: user
  originSessionId: d6541e9a-504e-48d2-a8a3-45a8e34a5911
---

The client on this project is non-technical (they launch and use the app
themselves; don't want to "pick over technical parts"). They explicitly value
being asked what they *meant* at each gate rather than handed a finished thing.

**How to apply:** Follow the CLAUDE.md SDD gates strictly — pause after
spec/plan/tasks and after each user story for hands-on feedback. Route every
reaction correctly: behaviour/what-it-should-do changes go back through the spec
first (they noticed and appreciated this discipline); implementation-only
divergences get fixed in code. Explain choices in plain terms, not jargon, and
be upfront about caveats (e.g. the [[bookmark-manager-project]] E2E limitation) —
they responded well to honesty over polish. Write user-facing docs for an
ordinary person, since they run things themselves.
