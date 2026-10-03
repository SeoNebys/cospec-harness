import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./client.server";

export function migrateDatabase(database = db) {
  migrate(database, {
    migrationsFolder: path.join(process.cwd(), "drizzle", "migrations"),
  });
}

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isEntrypoint) {
  migrateDatabase();
  sqlite.close();
  console.log("Database migrations applied.");
}
