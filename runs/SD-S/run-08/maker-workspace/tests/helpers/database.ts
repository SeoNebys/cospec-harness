import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabaseClient, type DatabaseClient } from "../../lib/db/client";
import { migrateDatabase } from "../../lib/db/migrate";

export type TestDatabase = { client: DatabaseClient; path: string; close(): Promise<void> };

export async function createTestDatabase(): Promise<TestDatabase> {
  const directory = await mkdtemp(join(tmpdir(), "bookmark-manager-"));
  const path = join(directory, "test.db");
  const client = createDatabaseClient(`file:${path}`);
  await migrateDatabase(client);
  return {
    client,
    path,
    async close() {
      await client.$disconnect();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

export async function withTestDatabase<T>(run: (client: DatabaseClient) => Promise<T>): Promise<T> {
  const database = await createTestDatabase();
  try { return await run(database.client); } finally { await database.close(); }
}
