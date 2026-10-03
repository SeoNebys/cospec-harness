# Operations

Create a consistent backup with `npm run backup -- backups/review-copy`. The command uses SQLite's online backup API so WAL state is included, then copies the normalized icon store. Check it with `npm run backup:verify -- backups/review-copy`.

To restore, stop Safekeep, place the verified `bookmarks.db` and `icons/` into the configured data locations, preserve ownership/permissions, run migrations, and start the app. Confirm account count, sample bookmarks, search, notes, archive/read state, and icons before reopening access.
