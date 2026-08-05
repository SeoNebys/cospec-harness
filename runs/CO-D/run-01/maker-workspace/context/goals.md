# Business goal statement

_Cycle 1 — confirmed in Phase 1, Goal exploration._

## One-liner (client's words)

> "Save fast, find it later, and don't lose it."

## The core goal

One place where the client can dump any link worth keeping, quickly, and
reliably retrieve it later — replacing the browser-bookmark folder mess that has
become impossible to search.

## Why (client's words)

> "It's the browser bookmarks mess. I've got hundreds of them piled up in
> folders, and when I actually need one I can never find it again. The folders
> made sense the day I made them and now they don't."

## Confirmed frustrations to remove

1. **Find by memory, not exact title.**
   > "I search for a link and can't find it because I don't remember the exact
   > title — I just remember it was 'that article about Rome.' So searching
   > needs to look inside the description and my own notes too, not just the
   > title."

2. **Labels, not folders (multiple per link).**
   > "I want to slap a few labels on things instead of forcing each link into
   > one folder. Like a recipe could be 'cooking' and 'italian' at the same
   > time."

3. **A workable "read later" pile.**
   > "A big pile of stuff is 'I'll read this later'... I'd want to flag those and
   > see just that list, then tick them off once I've read them."

4. **Survive link rot — keep a copy of the page (MUST-HAVE).**
   > "Half my old bookmarks now go to dead pages... whatever I save, I'd love it
   > to keep a copy of what the page actually said, so it's not gone forever."
   Client explicitly: must-have, not "someday." Sequencing may place it after
   1–3, but it must stay on the roadmap and not be quietly dropped.

5. **No duplicate saves.**
   > "When I go to save a link I've already got, I wouldn't want a second copy
   > created. I'd expect it to just recognize 'you already have this one' and
   > take me to the one I've got so I can tweak it."

## Parking lot (deferred functional items — do not drop)

- **Full "edit everything" view for a saved link** — alongside the quick
  in-place rename, the client wants a fuller space to edit: their own note, the
  description (when the auto one is off), labels, and occasionally the address
  itself (wrong paste). Confirmed Cycle 1. Quick rename stays; this is additive.
- **Normalize tracking parameters in duplicate detection** — strip `?utm_*` and
  similar tracking junk so newsletter/social links to the same article are
  recognized as duplicates. Confirmed real case (Cycle 1). Approved same-page
  rules so far: `www.`/no-`www.` and trailing `/` are treated as the same page.

- **Remove a link** — delete a saved link the client no longer wants ("clutter I
  want gone for good"). Part of the managing-links bucket. Noted Cycle 1, not yet
  explored.
- **Pointed / boolean search** — exclude ("Rome but not the recipes") and OR
  ("Rome or pasta") when browsing two topics. Noted Cycle 1, explicitly "later."
- **Quoted exact-phrase search** — typing `"..."` means find those words
  together, not scattered across fields. Noted Cycle 1, explicitly "later."
- **Undo an accidental label removal** — easy "put it back" after removing the
  wrong label with the ×. Client's passing thought, Cycle 1; small nicety, not
  urgent.
- **Sort by "recently opened"** — an order by how recently the client last
  opened a link ("what was I just looking at"). Cycle 1; welcome bonus, add if
  cheap, otherwise park. Core sorts (newest/oldest/title) are settled.
- **Light formatting in notes** — a touch of shape (bullet points, bolding) for
  notes that grow into several lines/lists, rather than one flat run-on. Client's
  noticed-while-using thought, Cycle 1; nice-to-have, not urgent.
- **External web-archive backstop** — beyond the client's own saved copy, also
  keep/point to a public web-archive copy (e.g. Wayback Machine) so there is a
  backstop even if their own copy is lost. Explicitly nice-to-have (Cycle 1),
  "helps me sleep," not a must. Involves an external service.

## Scope note

Client is not precious about *how* #4 is achieved and accepts sequencing it
after the fast-save / search / labels / read-later core — provided it remains on
the roadmap.

## Interface form

**Web app** — opened in a browser, same experience on laptop and phone.
Client's driver: they stumble on links across all devices, and today things get
lost because they're saved in whatever browser happened to be in use. "One place
I can reach from anywhere is the dream."

Key constraint (client's words): **"saving needs to be fast or I won't bother."**

### Roadmap bonus (not core)

Browser-extension quick-save button — "a little button in my toolbar to save the
page I'm looking at." Client frames it as "a nice bonus on top, not the main
thing." Build around the web app first.
