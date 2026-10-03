import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getConfig } from "../src/lib/config";

const config = getConfig();
const dbPath = path.resolve(config.DATABASE_PATH);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(path.resolve(config.ICON_DIRECTORY), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
sqlite.exec("CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");

const directory = path.resolve("src/lib/db/migrations");
for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
  const found = sqlite.prepare("SELECT 1 FROM __migrations WHERE name = ?").get(filename);
  if (found) continue;
  const sql = fs.readFileSync(path.join(directory, filename), "utf8");
  sqlite.transaction(() => {
    sqlite.exec(sql);
    sqlite.prepare("INSERT INTO __migrations (name, applied_at) VALUES (?, ?)").run(filename, Date.now());
  })();
  process.stdout.write(`Applied ${filename}\n`);
}
sqlite.close();
