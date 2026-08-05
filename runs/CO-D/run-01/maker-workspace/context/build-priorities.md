# Build priorities (client's moment-of-truth flags)

Recorded at the Phase 1 → Phase 2 handover, Cycle 1. Not new scope — these are
how the client will judge the real thing. Do not let them be squeezed.

## Invisible-discipline features — protect above all
These are what keep the app from rotting into "the same swamp as the browser":
1. **No duplicates** (SCN-004) — dedup must hold, including at import (SCN-013).
2. **Label reuse-nudge** (SCN-006) — steer away from "cooking"/"Cooking" twins;
   case-insensitive reuse is the discipline.
3. **Honesty when a copy can't be made** (SCN-009 capture-failed) — never a false
   promise of protection. This is the whole trust of "don't lose it".

If anything must give under pressure, it must NOT be these.

## Import is the day-one moment of truth
The client's first action will be importing their real pile: hundreds of links,
messy, years old. It must land gracefully — especially:
- Preserve original saved dates (SCN-013); garbled dates = first impression shot.
- Skip duplicates cleanly.
- Convert folders to split labels without choking on messy/edge folder names.
Handle scale and malformed rows robustly; this is where adoption is won or lost.
