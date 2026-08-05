# Bookmark Manager

A small app for saving and managing your own bookmarks. It runs **entirely on
your own computer** — nothing is sent to the internet, there are no accounts,
and no one else can see your bookmarks. You start it up, then use it in your web
browser.

---

## What you need first (one-time)

You need two free tools installed. You only do this once.

1. **Python** (version 3.11 or newer) — https://www.python.org/downloads/
2. **Node.js** (version 20 or newer) — https://nodejs.org/ (choose the "LTS" version)

During each installer, if you're asked whether to "Add to PATH", say **yes**.

To check they're installed, open a **Terminal** (macOS: the "Terminal" app;
Windows: "PowerShell") and type these two lines, pressing Enter after each:

```
python3 --version
node --version
```

If each prints a version number, you're ready.

---

## First-time setup (one-time)

In the Terminal, go to this app's folder. For example, if it's in your
Downloads:

```
cd ~/Downloads/bookmark-manager
```

Then run these three commands, one at a time (each may take a minute):

```
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
(cd frontend && npm install && npm run build)
```

> On **Windows**, use `backend\.venv\Scripts\pip` instead of
> `backend/.venv/bin/pip` in the second line.

That's the setup done. You won't need to repeat it unless you move the app.

---

## Starting the app (each time you want to use it)

1. Open a Terminal and go to the app's folder (the `cd …` line above).
2. Start it:

   ```
   backend/.venv/bin/uvicorn src.app:app --port 8765 --app-dir backend
   ```

   (Windows: `backend\.venv\Scripts\uvicorn src.app:app --port 8765 --app-dir backend`)

3. Open your web browser and go to:

   **http://localhost:8765**

That's the app. Add a link in the box at the top and press **Save**.

### Stopping it

Click back in the Terminal window and press **Ctrl + C**. You can close the
browser tab any time; your bookmarks are saved automatically.

---

## Where your bookmarks live (and backing them up)

Everything is stored in a single file on your computer:

- **macOS / Linux:** `~/.local/share/bookmark-manager/bookmarks.db`
- **Windows:** `…\AppData\Roaming\bookmark-manager\bookmarks.db`

To keep a safe copy, the easiest way is inside the app: click **Export → Full
backup (.json)**. That file contains everything — tags, notes, read/unread,
archived, and dates — and can be brought back with **Import**. Keep it somewhere
safe (or in your usual cloud drive) and you'll never lose your collection.

---

## A quick tour of what it does

- **Save a link** — paste a web address and press Save. The app fills in the
  page's title, icon, and a short description for you.
- **Find things** — search by keyword (put `"quotes"` around an exact phrase),
  or filter by tags (include several, or exclude one). Save a filter combo you
  use often and reopen it in a click.
- **Organise** — add tags (it suggests ones you've used), write notes, and sort
  newest-first or A–Z.
- **Read later** — flag links you mean to come back to; the "Read later" tab
  shows just those.
- **Archive** — tuck links off your main list without deleting them; restore
  any time.
- **Tidy in bulk** — select many at once (or everything matching a filter) and
  tag, untag, archive, mark, or delete them together.
- **Bring your browser bookmarks in** — Import your browser's exported bookmark
  file; your folders become tags and your original dates are kept.

Enjoy — it's yours, and it stays on your machine.
