# Business goal statement

Cycle: 1
Session: SESSION-001
Status: confirmed

## Client's request (verbatim)

> Right now my links are scattered across browser bookmarks, open tabs, and
> notes, so I often can't find something when I need it—or I save it twice.
>
> The heart of the app is having one dependable place where I can save a link
> quickly, organise it, search for it later, and open the original page. I'd
> also like to separate things I intend to read from things I'm simply keeping
> for reference, without losing either.
>
> So the bigger goal is really retrieval: I want confidence that something I
> saved months ago will be easy to find again. This is mainly for my own use;
> sharing collections isn't a priority.

> I picture it primarily as a web app that I can use on both my computer and
> phone. I'd most often save links while browsing, then return later—usually on
> my computer—to search, organise, or read them. It doesn't need to be a
> separate mobile or desktop app.

## Confirmed goal

The core value is **retrieval confidence**: one dependable home for links so
that something saved months ago is easy to find again — instead of being
scattered across browser bookmarks, open tabs, and notes (where things get lost
or saved twice).

Supporting capabilities the client named:
- Save a link quickly
- Organise it
- Search for it later
- Open the original page
- Distinguish "things I intend to read" from "things I'm keeping for reference",
  without losing track of either

Scope notes:
- Mainly for the client's own personal use
- Sharing collections is NOT a priority

## Interface form

Web app, used on both computer and phone (responsive web — not a separate
mobile or desktop app). Primary usage pattern: save links while browsing, then
return later (usually on computer) to search, organise, or read.

## Access decision

No sign-in for now. A private, single-person app the client reaches from both
devices; the saved collection lives in one shared place both devices reach.
(No multi-user, no authentication in this cycle.)

## Additional feature blocks to explore before Phase 2 (client-requested)

1. Bulk actions on selected bookmarks (add/remove tags, mark read/unread,
   archive, delete together); plus "apply to all in the current search/view"
   with a safeguard against accidentally acting on the whole collection.
2. Sorting (by date added, title, and other useful choices).
3. Offline copy of a page: a normal page kept as a single local page file; a PDF
   link preserved as the PDF; plus an option to submit a page to the Internet
   Archive.
4. Saved searches/filters: save search text + included/excluded tags to reopen a
   filtered collection later.
5. Import/export a standard browser-bookmarks HTML file, retaining titles, tags,
   and original saved dates where available.
6. Personal display preferences: default sort, how many items are shown, text
   size.
