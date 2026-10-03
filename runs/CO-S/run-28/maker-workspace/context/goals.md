# Business goal

## Cycle 1 — established 2026-09-27 (SESSION-001)

### Goal statement (client's language)

> I want one dependable personal place where I can quickly save a link,
> organize it, and later find it by searching or browsing categories.
> The real difference should be that saving something makes it genuinely
> retrievable and useful later, rather than sending it into another messy pile.

### Context / motivation

The client currently scatters links across browser bookmarks, notes, and open
tabs, then either forgets them or cannot find them again. The pain is not saving
— it is *retrieval and usefulness later*.

### Confirmed scope characteristics

- **Personal, single-user.** Just for the client. No sharing or collaboration.
- **Quick save** of a link.
- **Organize** into categories.
- **Retrieve** later by (a) searching and (b) browsing categories.
- **Read-later queue** — a separate active queue: view only these items, mark
  an item as read when done.
- **Archive** — keep links but remove them from the normal view; a separate
  place to find and restore archived links.
- **Main view** shows recent, non-archived saves (not only unread items).

### Explicitly separated concepts

- "Read later" (active queue, mark-as-read) and "Archive" (out-of-the-way keep
  + restore) are **two distinct needs**, not one.

### Deferred to a later cycle (recorded, not in scope this cycle)

- **Preserving a copy of the saved page** so it stays accessible even if the
  original changes or disappears. The client considers this important but
  explicitly wants it as a *later addition* rather than holding up the useful
  first version. See context/later-cycle-requests.md.

### Interface form

- **Web app in the browser.**
- Must work comfortably on both a computer and a phone (responsive).
- No separate native mobile or desktop app needed.
