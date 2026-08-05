# Non-functional backlog

Recorded autonomously during Phase 1. To be addressed after the functional flow
is locked down.

| # | Item | Source | Type |
|---|------|--------|------|
| NF-1 | Saving must feel fast / "out of the way" — minimal friction at capture time | "exactly the kind of out-of-my-way I wanted" | UX / performance |
| NF-2 | The list must stay quick to scan (tidy rows, truncation over wrapping) | repeated preference for scanning quickly; SCN-004 | UX |
| NF-3 | Search must stay responsive as the list grows to hundreds of links | "a big list doesn't worry me — searching is how I'd cut through it" | Performance |

## Notes / assumptions to confirm at implementation
- Persistence: saved links must survive closing/reopening the browser (inherent
  to a "save" app). Confirm storage approach in Phase 2.
- Single device: client uses it mostly on their computer; cross-device sync was
  NOT requested and is treated as out of scope for cycle 1.
</content>
