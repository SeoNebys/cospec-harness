import assert from "node:assert/strict";
import test from "node:test";
import { migrateDatabase } from "../../lib/db/migrate";
import { createTestDatabase } from "../helpers/database";

test("initial migration is valid and reopening is idempotent", async () => {
  const database = await createTestDatabase();
  try {
    await migrateDatabase(database.client);
    const integrity = await database.client.$queryRawUnsafe<Array<{ integrity_check: string }>>("PRAGMA integrity_check");
    const foreignKeys = await database.client.$queryRawUnsafe<Array<{ foreign_keys: bigint }>>("PRAGMA foreign_keys");
    assert.equal(integrity[0]?.integrity_check, "ok");
    assert.equal(Number(foreignKeys[0]?.foreign_keys), 1);
  } finally { await database.close(); }
});
