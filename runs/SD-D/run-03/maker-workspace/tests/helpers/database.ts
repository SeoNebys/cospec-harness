import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type AppDatabase, closeDatabase, openDatabase } from "../../src/server/db/database.js";
import { runMigrations } from "../../src/server/db/migrate.js";

const DEFAULT_MIGRATIONS_DIRECTORY = fileURLToPath(new URL("../../migrations/", import.meta.url));

export interface TestDatabaseOptions {
  migrate?: boolean;
  migrationsDirectory?: string;
  prefix?: string;
}

export interface TestDatabase {
  database: AppDatabase;
  databasePath: string;
  directory: string;
  appliedMigrations: readonly number[];
  cleanup: () => void;
}

/**
 * Creates a real, file-backed database so WAL, locking, and uniqueness behavior
 * match production. Every call owns a separate mkdtemp directory.
 */
export function createTestDatabase(options: TestDatabaseOptions = {}): TestDatabase {
  const directory = mkdtempSync(path.join(tmpdir(), options.prefix ?? "bookmark-garden-test-"));
  const databasePath = path.join(directory, "bookmarks.sqlite");
  const database = openDatabase(databasePath);
  let cleaned = false;

  try {
    const appliedMigrations =
      options.migrate === false
        ? []
        : runMigrations(database, options.migrationsDirectory ?? DEFAULT_MIGRATIONS_DIRECTORY);

    return {
      database,
      databasePath,
      directory,
      appliedMigrations,
      cleanup: () => {
        if (cleaned) return;
        cleaned = true;
        closeDatabase(database);
        rmSync(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    closeDatabase(database);
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function withTestDatabase<T>(
  run: (fixture: TestDatabase) => T | Promise<T>,
  options: TestDatabaseOptions = {},
): Promise<T> {
  const fixture = createTestDatabase(options);
  try {
    return await run(fixture);
  } finally {
    fixture.cleanup();
  }
}
