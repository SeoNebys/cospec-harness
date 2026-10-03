import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "~/db/client.server";
import { migrateDatabase } from "~/db/migrate.server";

export function createTestDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "keepsake-test-"));
  const databasePath = path.join(directory, "test.sqlite");
  const database = createDatabase(databasePath);
  migrateDatabase(database.db);
  return {
    ...database,
    databasePath,
    cleanup() {
      database.client.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
