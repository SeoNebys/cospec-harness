# My Bookmarks

One trusted spot to drop a link and actually find it again.

## Run it

Requires Node.js 18 or newer. No installation step — there are no dependencies.

```bash
cd implementation
npm start
```

Then open **http://localhost:3000** in your browser.

Your links are saved to `implementation/data/bookmarks.json` and will still be
there next time you open the app.

### Options
- `PORT=4000 npm start` — use a different port.
- `BOOKMARKS_FILE=/path/to/file.json npm start` — store links elsewhere.

## Test it

```bash
cd implementation
npm test
```

## What it does
- Paste a link → it's saved at the top with the page's name found automatically,
  address underneath.
- Click a name to open it; hover for a pencil (rename) and trash (remove) button.
- Removing shows an Undo for a few seconds.
- Search filters live by name or address, highlighting matches; or just scroll.
- Duplicates aren't re-saved — it points you to the one you have.
- Non-links get a gentle "save anyway?" check.
