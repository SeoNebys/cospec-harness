# Edge-case & extension candidates

Raised during the SbE loop; experienced via guided confirmation and, once
approved, promoted to SCN-NNN scenarios.

## From SESSION-001

### Promoted (approved)
- Open a saved link -> SCN-002
- Duplicate save handling -> SCN-003
- Unreadable page fallback -> SCN-004
- Edit via focused pop-up -> SCN-005

### Promoted (approved) — cont.
- Labels with suggestions -> SCN-006
- Personal note -> SCN-007

### Open candidates
- **EXT: Note formatting.** The personal note may grow to support light
  structure (a bullet or two, bold) rather than one flat line. Recorded from
  SCN-007 approval. Not urgent per client.

### In progress
- **Narrow / round up by topic (label filter).** Click a label / pick a topic
  and the library falls away to just those links. Client: "the moment labels
  actually earn their keep." Exploring interaction now (p5).

### Promoted (approved) — cont.
- Search across the library -> SCN-009
- Read-later lens -> SCN-010
- Drain the pile (single/bulk/honest exits) -> SCN-011

### Promoted (approved) — cont.
- Bulk library actions + delete for good -> SCN-012

### Promoted (approved) — cont.
- Set-aside shelf -> SCN-013

### Promoted (approved) — cont.
- Calmer card actions (delete behind "⋯", hover labels) -> folded into SCN-012

### Promoted (approved) — cont.
- Sorting (dropdown, 4 orders, persists across lenses) -> SCN-014

### Promoted (approved) — cont.
- Import & export (preview-first, folders→labels, keep original dates, 2 export
  formats) -> SCN-015

### Promoted (approved) — cont.
- Saved-copy safety net (auto, readable-core, best-effort, off-switch) -> SCN-016

### Promoted (approved) — cont.
- PDFs as real files + opt-in public archive -> SCN-017

### Promoted (approved) — cont.
- Exclude a topic (explicit "−", visible, saved) -> SCN-021

### Remaining edge sweep before Phase 2 (p22 + text confirms)
- Pasting something that isn't a link (typo/plain text) — gentle inline handling.
- Overflow: very long title/note, many labels — graceful layout.
- Temporal (text-confirm): a live page that *changed* vs died (honest limit —
  we reliably detect unreachable, not subtle content change; copy always there);
  re-saving a previously-deleted link; how dates are shown.

### Later-cycle enhancements (raised during build, recorded)
- **Edit a saved view in place** (add/remove a topic, change search) rather than
  remove + re-pin. Client bumped into it; not urgent. (SCN-020)
- **"Capture a copy now" backfill** for links saved before the saved-copy feature
  existed (they currently have no copy until re-saved). (SCN-016)

### Future nice-to-haves (recorded, not committed)
- Search the words *inside* saved PDFs. (client: lovely someday, not required)
- Note light formatting (bullets/bold) — from SCN-007.

### Next: systematic edge-case sweep (Phase 1 Step 3) before proposing build
Feature blocks are settled (SCN-001..017). Remaining before a responsible
Phase 2 proposal — deliberately sweep the four edge perspectives for gaps not
yet confirmed with the client:
- **Absence of data:** the very first run / empty library (never shown) — how a
  brand-new user with zero links starts, and the nudge to import.
- **Error/exception:** pasting something that isn't a real link (typo/plain
  text); saving while offline (no title/snapshot fetch).
- **Boundary:** very long titles/notes and links with many labels (overflow);
  the feel of a very large library.
- **Temporal:** a live page that has *changed* (not just died); re-saving a link
  that was previously deleted; how dates are shown.
