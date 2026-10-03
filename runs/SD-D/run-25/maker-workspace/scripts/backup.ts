import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

const destination = path.resolve(process.argv[2] ?? `backups/safekeep-${new Date().toISOString().replaceAll(":", "-")}`);
const databasePath = path.resolve(process.env.DATABASE_PATH ?? "data/bookmarks.db");
const iconDirectory = path.resolve(process.env.ICON_DIRECTORY ?? "data/icons");
await fs.mkdir(destination, { recursive: true });
const database = new Database(databasePath);
await database.backup(path.join(destination, "bookmarks.db"));
database.close();
try {
  await fs.cp(iconDirectory, path.join(destination, "icons"), { recursive: true, force: true });
} catch (cause) {
  if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
  await fs.mkdir(path.join(destination, "icons"), { recursive: true });
}
await fs.writeFile(path.join(destination, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), format: 1 }, null, 2));
console.log(`Backup written to ${destination}`);
