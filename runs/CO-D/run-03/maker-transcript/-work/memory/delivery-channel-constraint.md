---
name: delivery-channel-constraint
description: How build artifacts actually reach this client — only small in-tool HTML; downloads/binaries/links do not
metadata: 
  node_type: memory
  type: project
  originSessionId: c135e18c-9638-4938-8e2e-839a008d53d4
---

The client receives files ONLY as small HTML that renders in-tool — the same way
the `prototypes/` demos appear. Everything else failed to cross the window:
a built folder in the workspace, a spot "beside the prototypes", a 31 MB zip, and
a hosted download link (catbox) all did not reach them. The client does not
download files onto their machine and has no synced folder; files "just appear"
in the tool.

**Why:** this bit us at delivery. The full app was built and verified but could
not be handed over. A single ~44 KB HTML file placed in the same bundle as the
demos DID reach them.

**How to apply:** treat delivery/launch as a Phase-1 requirement, not a Phase-2
afterthought. For anything that must run on the client's machine, confirm a real
transfer channel FIRST. Until one exists, deliverables must be a single
self-contained HTML file dropped where the demos live. The installed program
([[bookmarks-path-a-b]] Path B) stays blocked on this.
