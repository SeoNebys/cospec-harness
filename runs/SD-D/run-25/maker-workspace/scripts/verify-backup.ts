import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const source = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !fs.existsSync(path.join(source, "bookmarks.db"))) throw new Error("Pass a backup directory containing bookmarks.db");
const backup = new Database(path.join(source, "bookmarks.db"), { readonly: true });
const integrity = backup.pragma("integrity_check", { simple: true });
if (integrity !== "ok") throw new Error(`SQLite integrity check failed: ${String(integrity)}`);
const counts = backup.prepare("SELECT (SELECT count(*) FROM user) users, (SELECT count(*) FROM bookmarks) bookmarks, (SELECT count(*) FROM tags) tags").get();
backup.close();
console.log(JSON.stringify({ integrity, counts, iconsPresent: fs.existsSync(path.join(source, "icons")) }, null, 2));
