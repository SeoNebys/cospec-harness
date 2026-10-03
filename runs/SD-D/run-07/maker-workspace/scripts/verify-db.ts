import { openDatabase } from "../lib/db/connection";
import { migrate } from "../lib/db/migrate";
const db = openDatabase(); migrate(db);
const fk = db.pragma("foreign_key_check") as unknown[];
if (fk.length) throw new Error(`Foreign key violations: ${fk.length}`);
const bookmarks = (db.prepare("SELECT count(*) count FROM bookmarks").get() as {count:number}).count;
const indexed = (db.prepare("SELECT count(*) count FROM bookmark_search").get() as {count:number}).count;
if (bookmarks !== indexed) throw new Error(`Search index mismatch: ${bookmarks}/${indexed}`);
db.close(); console.log(`Database verified (${bookmarks} bookmarks).`);
