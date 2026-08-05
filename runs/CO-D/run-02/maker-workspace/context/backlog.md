# Backlog — future cycles

Captured at the end of Cycle 1 (SESSION-001). Not started; here so nothing is lost.

## Committed for the NEXT cycle
- **Full "reads the page for you" auto-fill (all sites).** Today auto-fill covers
  a seeded set and otherwise degrades to "type the title yourself". The client
  accepted the fallback for now on the explicit understanding that reading any
  page is the *next* job (their words: "next, not someday"). Needs a small fetch
  helper — see the metadata note in implementation/docs/design-decisions.md.
  Motivation: typing the title for most saves chips at the effortlessness that
  made saving feel nice (relates to the core goal in goals.md).

## Someday (future conversation, client-raised, not a condition)
- **Keeping a safe copy of the collection.** As the collection grows the client
  will get "twitchy about losing it all if the laptop died." Explore a
  backup/export (and restore) path, or a copy-safe story. To be facilitated as
  its own goal exploration when the client wants to pick it up.

## Parked scope (from Cycle 1)
- **SCN-003: gather by two or more labels at once.** Client parked this
  deliberately; revisit only if they ask.

## Known limitation to keep in view
- The launcher requires Node.js on the client machine (accepted trade for
  reliable persistence). If zero-Node ever matters, revisit a packaged desktop
  app (an install — previously out of scope) — client said not to chase this
  unless it becomes easy.
