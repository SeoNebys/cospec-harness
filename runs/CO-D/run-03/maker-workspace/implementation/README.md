# My Bookmarks

A personal bookmark manager built for **rediscovery**: save a link in one paste,
find it again later by anything you remember, and never lose what you saved.

## What it does (this build)
- **One-paste save** with the title, image, and summary grabbed for you, and a
  **readable copy of the page kept automatically** — so the content survives even
  if the original dies.
- **Fix anything** (title, address, summary) at save or later; deliberately pull
  fresh info when you saved the wrong page.
- **Search across everything you remember** — titles, summaries, labels, and the
  full saved content — obvious matches first, with a plain "here's how I read your
  search" bar, and precise moves (`"exact phrase"`, `either or`, `not word`).
- **Point search at one corner** (a label group or the to-read pile), one click
  back out.
- **Your own labels**, a **to-read pile** you check off, and an **archive** for
  things you're done with — each distinct from deleting for good.
- **Move in from your browser**: bulk import (history dates kept, folders as
  labels, duplicates skipped, dead links honestly flagged) and **export
  everything** back out anytime — no lock-in.

## Run it
```
cd implementation
npm install
npm start
```
Then open http://localhost:4000. Data is stored in `implementation/data/`
(override with `BOOKMARKS_DATA=/some/path`).

## Test
```
npm test
```
Acceptance tests are mapped to the approved scenarios in
`docs/scenario-code-map.md`; page-capture is mocked so the suite needs no network.

## Coming next round
Choosing the list order, saving searches you run often, and tidying several at once.
