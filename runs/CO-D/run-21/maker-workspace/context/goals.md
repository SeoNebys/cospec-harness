# Business goal

## Cycle 1 — established

### Client's own words (verbatim)

> It's just for me. Right now links are scattered across browser bookmarks,
> notes, and tabs, so I often can't find something when I need it—or remember
> why I saved it.
>
> I'd like one place where I can quickly save a link, organize it, search for it
> later, and keep track of things I still want to read. I'd also like older
> links to remain useful even if the original page changes or disappears.
>
> For remembering why, I'd want both: tags for organizing and a short personal
> note for context. I'd also expect the app to fill in basics like the page
> title and description automatically, while letting me correct them.
>
> For old links, I mean an actual saved copy of the page as it was when I
> bookmarked it—not only my title and note. For a PDF, I'd want the PDF itself
> preserved.
>
> A few other expectations come to mind: I should be able to archive links
> without deleting them, avoid accidentally creating duplicates when I save the
> same address again, and eventually bring in my existing browser bookmarks and
> export them again if needed. As the collection grows, filtering, sorting, and
> making changes to several matching links at once will also matter.

### Goal statement (confirmed framing)

Never lose a link or the reason it was saved, and always be able to get back to
it. A single personal home for links that makes saving effortless, keeps the
context (why it was saved), lets links be found again later, and keeps old links
useful even when the original page changes or disappears.

### Audience

Single user (personal use only).

## Feature wishlist (client-stated scope)

1. Quick save of a link with little effort
2. Auto-fill page title and description, with the ability to correct them
3. Tags for organizing
4. Short personal note per link for context
5. Preserve a saved copy of the page as it was at save time (PDF preserved as
   the actual PDF)
6. Search to find links later
7. Track reading status ("still want to read" vs. dealt with)
8. Archive links without deleting
9. Duplicate avoidance when saving the same address again
10. Filter and sort as the collection grows
11. Bulk changes across several matching links at once
12. Import existing browser bookmarks; export them again if needed

## Working approach

Core everyday flow (save -> add context -> find again) settled first (SCN-001..011).
Client then decided the first usable version must ALSO include the items below;
they are pulled into cycle 1 scope (no longer deferred):
- Read/unread status and viewing only unread
- Archive/restore, distinct from permanent delete
- Preserve a local copy of a page (actual file for PDFs); optional copy to the
  Internet Archive
- Bulk actions on several links, or all links matching the current search/filter:
  add/remove tags, change read status, archive, delete
- Saved searches (a search plus included/excluded tags) for reuse
- Import browser bookmarks and export them, retaining titles, tags, and original
  dates
- Preferences: default sort, number displayed, text size

Being settled one feature block at a time via prototype-guided confirmation.

## Interface form

Browser-based website. Primary use on laptop/desktop. Should remain usable on a
phone (responsive), but no separate mobile app required.
