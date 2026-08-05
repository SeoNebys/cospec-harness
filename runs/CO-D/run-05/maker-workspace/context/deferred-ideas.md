# Deferred functional ideas

Functional capabilities the client has explicitly named but agreed to build later, once
the current core is solid. Kept here so they are not lost and so we "don't paint ourselves
into a corner."

| # | Idea | Origin | Notes |
|---|------|--------|-------|
| 1 | Rename / delete a label everywhere at once | Cycle 1, labels | Change "work stuff" → "work" in one place and have it update on every link; no hunting one by one. Build after put-and-pull is solid. |
| 2 | Narrow by two (or more) labels at once (AND) | Cycle 1, labels | e.g. "show things that are both work stuff AND still to-read." Currently one pile at a time. Don't design in a way that blocks this. |
| 3 | Personal note on a link + correcting the web address | Cycle 1, edit panel | The edit panel is meant to grow to hold these. Note should also be searchable (see #4). |
| 4 | Plain-text search (NEXT UP) | Cycle 1, ongoing | Type a half-remembered word — part of the title, or something jotted in a note — and find the link whether or not it was labelled. Client considers this separate from labels and still core. |
| 5 | "Read later" pile | Cycle 1, goal | Mark links to read, view just that pile, check them off. One of the four original "working well" criteria; still outstanding. |
| 6 | Pin search to the current label pile | Cycle 1, search | Sweep-everything stays the default (the half-remembered case). But when deliberately viewing one pile (e.g. "work stuff"), let the client scope the search to just that pile — "the work one about metrics" without recipes dragged in. Matters once a lot is saved. |
| 7 | Keep a snapshot of the page's content — **FIRM NEXT CYCLE** | Cycle 1, rough-weather | Client wants a saved link to survive even if the original site later dies — "keep a bit of the page itself, not just a pointer." DECIDED: build the current core now, snapshot is the *immediate* fast-follow (cycle 2), NOT a "someday, maybe." Client is counting on it. **PDF handling is a hard requirement:** a real chunk of what the client saves are PDFs (reports, recipes, articles); the snapshot must keep the actual PDF file itself, not a snapshot of a wrapper. Surface early in cycle 2. |
