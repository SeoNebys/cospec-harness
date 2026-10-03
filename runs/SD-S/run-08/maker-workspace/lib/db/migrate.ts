import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PrismaClient } from "../../generated/prisma/client";
import { db } from "./client";

export async function migrateDatabase(client: PrismaClient = db): Promise<void> {
  const sql = await readFile(resolve(process.cwd(), "prisma/migrations/0001_initial/migration.sql"), "utf8");
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/u)
    .map((statement) => statement.trim())
    .filter(Boolean);
  await client.$executeRawUnsafe("PRAGMA foreign_keys=ON");
  for (const statement of statements) {
    try {
      await client.$executeRawUnsafe(statement);
    } catch (error) {
      if (!(error instanceof Error) || !/already exists/u.test(error.message)) throw error;
    }
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  await migrateDatabase();
  await db.$disconnect();
}
