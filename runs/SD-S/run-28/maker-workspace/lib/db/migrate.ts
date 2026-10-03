import fs from "node:fs";
import path from "node:path";
import type { AppDatabase } from "@/lib/db/client";

export function migrate(database: AppDatabase, directory = path.join(process.cwd(), "db/migrations")): string[] {
  database.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    (database.prepare("SELECT name FROM _migrations").all() as Array<{ name: string }>).map((row) => row.name),
  );
  const files = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()
    : [];
  const completed: string[] = [];
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = fs.readFileSync(path.join(directory, name), "utf8");
    database.transaction(() => {
      database.exec(sql);
      database.prepare("INSERT INTO _migrations(name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
    })();
    completed.push(name);
  }
  return completed;
}
