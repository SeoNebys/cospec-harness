import fs from "node:fs";
import path from "node:path";
import type { AppDatabase } from "./database.js";

interface MigrationFile {
  version: number;
  name: string;
  filePath: string;
}

function discoverMigrations(directory: string): MigrationFile[] {
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d{3}_.+\.sql$/.test(entry.name))
    .map((entry) => {
      const version = Number.parseInt(entry.name.slice(0, 3), 10);
      return { version, name: entry.name, filePath: path.join(directory, entry.name) };
    })
    .sort((left, right) => left.version - right.version);
}

export function runMigrations(
  database: AppDatabase,
  directory = path.resolve(process.cwd(), "migrations"),
): number[] {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all()
      .map((row) => (row as { version: number }).version),
  );

  const completed: number[] = [];
  for (const migration of discoverMigrations(directory)) {
    if (applied.has(migration.version)) continue;
    const sql = fs.readFileSync(migration.filePath, "utf8");
    const apply = database.transaction(() => {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, new Date().toISOString());
    });
    apply.immediate();
    completed.push(migration.version);
  }

  database.pragma("optimize");
  return completed;
}
