# Business goal statement

Cycle: 1
Session: SESSION-001
Interface form: Web app (used in a browser)

## Goal (in the client's language)

Right now my links are scattered and hard to find again, so I want one place
where I can save a URL quickly and later retrieve it by searching or using tags.

"Managing" mostly means keeping useful details with each link, marking things to
read later, and archiving links I want to keep without cluttering the main view.
I'd also like the app to pick up the page title and other basic information
automatically, while still letting me correct it or add my own notes. If I save
the same link twice, I'd expect it to bring me back to the existing bookmark
rather than create a duplicate.

## Heart of the goal (client's stated priority)

Being able to find a saved link again quickly is the heart of it.
- Search should look through the address, title, description, and notes.
- Search should ignore capitalization (case-insensitive).
- Tags should make it easy to narrow things down.

Saving should still feel quick, but good search and organization are what make
the app worth using.

## Scope notes

- Primarily a single user (the client), for personal use.
- Confirmed features mentioned (to be concretised via scenarios in later steps):
  quick saving, auto-filled page title/basic info with manual correction,
  personal notes/details, search (URL/title/description/notes, case-insensitive),
  tags, read-later marking, archiving, duplicate handling (return to existing
  bookmark).
