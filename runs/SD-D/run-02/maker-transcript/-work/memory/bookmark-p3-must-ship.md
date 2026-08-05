---
name: bookmark-p3-must-ship
description: "Client requires all P3 bookmark-manager stories be built, not dropped for being last"
metadata: 
  node_type: memory
  type: project
  originSessionId: eb7434e6-15e4-477a-8df4-6e455c2ccfc0
---

For the Bookmark Manager (specs/001-bookmark-manager), the client explicitly asked that the
P3 items — snapshots (US8), bulk actions (US9), import/export (US10), saved searches (US11),
and preferences (US12) — actually get built. They accept these coming later in the order but
NOT being quietly dropped because they are last.

**Why:** The client values these features (durable snapshots against link rot, migrating their
existing bookmarks, and reusable searches) and raised a specific worry that last-priority work
tends to fall off the list.

**How to apply:** Complete all P3 phases through the tasks list; do not stop after the MVP or
P2 stories. The optional web-archive opt-in (FR-027a, T068) is the only genuinely deferrable
item. Follow the SDD gates — see [[bookmark-manager-sdd]] if present.

**STATUS (2026-07-13): SHIPPED.** All P3 stories were built and the client approved the result.
Every task in tasks.md is complete except that the Playwright E2E suite (written + valid) could
not be executed in the build sandbox for lack of browser OS libraries; it runs on a normal
machine. No pending work unless the client reports something after their own spin.
