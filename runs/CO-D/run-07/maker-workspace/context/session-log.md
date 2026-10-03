# Session log

## SESSION-001 (Cycle 1, Phase 1)

- Goal confirmed and recorded (context/goals.md). Interface form: web app,
  desktop-primary, phone-comfortable (NFR-001).
- SCN-001 (one-step save with auto-filled page details) approved by client.
- Client requests folded into exploration:
  1. Thumbnail + site icon must come from the actual page (SCN-001 assumption).
  2. Ability to correct auto-filled title/description (SCN-002 — exploring now).
  3. Pasting an already-saved link must not duplicate; take user to the existing
     bookmark to update (SCN-003 — queued for the round immediately after the
     editing interaction is settled).
- Interaction exploration for SCN-002: presenting 3 alternative prototypes
  (edit-a/b/c) that differ ONLY in the correction interaction; all otherwise
  identical and all showing realistic thumbnails/favicons.
- Prototype-fidelity note (recorded per principles): thumbnails and favicons in
  the prototype are realistic simulated stand-ins generated locally, because a
  Phase-1 prototype does not fetch live pages. The approved behaviour is that
  these images are sourced from the actual page; fidelity of the source is a
  prototype limitation, not a requirement change.
- Sequencing note: duplicate handling (SCN-003) deferred one round to keep
  guided confirmation to one decision at a time; explicitly acknowledged to the
  client so it is not dropped.

### Progress through SESSION-001

Approved happy paths and edges (SCN-001..010): save-with-preview; correct via
shared edit screen; duplicate -> open existing; tags (chips + reuse) & formatted
notes; finding (search language + tag click + status, all combine); read/finished
separation; empty states; error states; sorting; remembered sort + Settings.

Edge-case exploration coverage:
- Absence of data: empty collection, empty focused views (SCN-007).
- Boundary: long title/desc/note, many tags, ~65-item collection; wrapping fixed
  for narrow screens; led to sorting (SCN-009) + remembered preference (SCN-010).
- Error/exception: non-link input blocked; unreadable page still saveable;
  malformed search falls back with notice (SCN-008, SCN-005).
- Temporal: saved date shown per bookmark; "remembered between visits" (SCN-010).

Non-functional items recorded: NFR-001..004 (phone comfort, large-collection
performance, per-account persistence, live page-detail fetch).

Interaction exploration reason notes: presented 2-3 alternatives for correction
(edit-a/b/c), duplicate handling (dup-a/b), tag entry (tags-a/b/c), and
read/finished view (read-a/b/c). Sorting/persistence had a clear single client
direction; assumptions disclosed and confirmed rather than offering variants.

First Phase-2 proposal declined; client added a further management scope, all
explored and approved this session:
- SCN-011 open/edit-address/delete (Option B action layout; address-edit dedup)
- SCN-012 Archive (separate link; hidden from views+search; restore)
- SCN-013 Bulk actions (Select mode; select-all-matching; tags/status/archive/delete)
- SCN-014 Saved views (search + include/exclude tags; reusable rule; persisted)
- SCN-015 Preserved copies (auto default + Settings off; PDF-as-PDF; IA explicit)
- SCN-016 Import/Export (folders->tags; dedup; dates kept; standard format; archived incl.)
- SCN-017 Settings: items-per-page (paging) + text size; persisted

Interaction exploration alternatives presented: action layout (action-a/b),
archive view (arch-a/b), selection style (select-a/b), preserve timing
(preserve-a/b). Duplicate/no-copy/format decisions confirmed via disclosed
assumptions. Edge cases folded in: empty archive message, bulk-none hides bar,
import 0-new disables, pagination clamps current page after deletes.

NFR backlog updated: NFR-005 (real capture/storage + Internet Archive).

Full regression across all features passed (no JS errors). Re-proposing Phase 2.
