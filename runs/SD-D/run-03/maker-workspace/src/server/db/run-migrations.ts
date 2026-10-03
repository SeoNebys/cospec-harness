import { loadConfig } from "../config.js";
import { closeDatabase, openDatabase } from "./database.js";
import { runMigrations } from "./migrate.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);

try {
  const versions = runMigrations(database);
  process.stdout.write(
    versions.length > 0
      ? `Applied migrations: ${versions.join(", ")}\n`
      : "Database is up to date.\n",
  );
} finally {
  closeDatabase(database);
}
