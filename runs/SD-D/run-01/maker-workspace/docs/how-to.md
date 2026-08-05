# Bookmark Manager — How to use it

A short, friendly guide. No technical knowledge needed.

## Starting the app

Double-click the **Bookmark Manager** icon (on your Desktop or in the Start menu). Your web
browser opens with the app ready. Leave the small background window open while you use it;
closing it quits the app. Everything is stored on your own computer — nothing goes online.

> Setting up the icon the first time? See `packaging/build-windows.md`.

## Saving a bookmark

1. Paste or type a web address into the box at the top.
2. Click **Save**.

The app fetches the page's title and site icon for you. If a page can't be reached, it's
still saved using the address as its name. If you save a link you already have, it opens
that existing bookmark so you can tweak it — no duplicates.

## Opening a bookmark

Click a bookmark's title to open the page in a new browser tab.

## Editing, notes, and deleting

Click **Edit** on any bookmark to:

- Change its **title** or **address**.
- Write a **note** — use the small toolbar for **bold**, bullet lists, and links. If the
  page had a short description, you'll find it already sitting in the note, ready to keep or
  change.
- Add **tags** (see below).
- **Delete** it — you'll be asked to confirm first, so nothing vanishes by accident.

## Tags — grouping your bookmarks

In the Edit box, type a tag and press Enter (or comma). As you type, the app suggests tags
you've used before, so you don't end up with "recipe" and "recipes" meaning the same thing.
Click the **×** on a tag to remove it.

To see everything with a given tag, click that tag on any bookmark. A "Filtered by tag"
banner appears; click **Clear** to show everything again.

## Finding things

- **Search box**: type any word. It looks in titles, addresses, notes, and tags, and
  ignores capital letters ("Recipe" and "recipe" find the same things).
- **All the words**: typing `chicken soup` finds bookmarks that contain *both* words.
- **An exact phrase**: put quotes around it — `"chicken soup"` finds only bookmarks where
  those words appear together.
- **Combine with a tag**: filter by a tag *and* type a search to narrow down further.
- **Sort**: use the dropdown to switch between newest-first and A–Z by title.

## Bringing in your existing browser bookmarks

1. In your web browser, export your bookmarks to a file (usually called `bookmarks.html`):
   - **Chrome/Edge**: Bookmarks manager → ⋮ menu → *Export bookmarks*
   - **Firefox**: Bookmarks → Manage Bookmarks → Import and Backup → *Export Bookmarks to HTML*
   - **Safari**: File → *Export Bookmarks*
2. In this app, click **Import browser bookmarks** and choose that file.

Your folders become tags, original dates are kept, and anything you already have is skipped
(you'll see a "imported X, skipped Y" message).

## Getting your bookmarks back out (backup)

Click **Export to a file** to download a `bookmarks.html`. Keep it as a backup, open it in
any web browser, or import it back here later — your tags and dates come with it. Your links
are always yours.

## Where your data lives

Everything sits in a single file on your PC:
`C:\Users\<your name>\.bookmark-manager\bookmarks.db`. Copy that file anytime to back it up,
or use **Export to a file** above.
