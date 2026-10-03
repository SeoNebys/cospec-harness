# Business goal

## Cycle 1 — recorded SESSION-001 (2026-09-18)

## Client's words (verbatim)

> It's mainly for me. I save lots of links intending to return to them, but they
> disappear into a messy browser bookmark list and become hard to find.

> I'd like one personal place where I can quickly save a link, organise it, find
> it again by searching, and keep track of what I still want to read. I'd also
> like to archive things I want to keep without cluttering the main view. Sharing
> and multiple users aren't priorities.

> I picture it as a web app I can open in my browser, with a layout that also
> works comfortably on my phone. I don't need a separate mobile or desktop app.

## Goal statement (confirmed)

Links I save actually get found and read again, instead of disappearing into a
messy pile.

One personal place where the client can:
- quickly capture a link,
- organise it so it does not become an unmanageable pile,
- find it again by searching,
- track what is still to read vs. done,
- archive things worth keeping without cluttering the main view.

## Scope notes

- Single user (the client). Sharing and multiple accounts are explicitly NOT
  priorities.
- Interface form: responsive web app (browser + comfortable on phone). No
  separate mobile/desktop app.

## Additional cycle-1 scope (client confirmed SESSION-001, must explore before build)

- Sorting by date added or by title; choose a default sort order (newest-first is
  the current behaviour, per SCN-001).
- Control how many bookmarks are shown at once.
- Adjustable text size for reading comfort.
- Bulk selection: select several bookmarks, or all matching the current search /
  tags / view, and apply together: add/remove tags, mark read/unread, archive,
  or delete.
- Saved local copy (snapshot) of a page so it stays available if the original
  changes or disappears; for a PDF, save the PDF itself; option to also preserve
  via the Internet Archive.
- Saved named views: save a combination of search text plus included/excluded
  tags as a reusable named view.
- Import and export standard browser bookmark files; on import, retain titles,
  tags, and original saved dates.

## Deferred to later cycles

- Automatic grouping of bookmarks by website could be a helpful *secondary*
  view, but must not replace tags as the primary way of organising. Recorded
  from SESSION-001; not built in cycle 1 (client agreed this one can wait).
