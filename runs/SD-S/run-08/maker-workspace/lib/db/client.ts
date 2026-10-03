import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client";

export type DatabaseClient = PrismaClient;

const defaultPath = resolve(process.cwd(), "data/bookmarks.db");

function toAdapterUrl(input?: string): string {
  const value = input ?? process.env.DATABASE_URL ?? `file:${defaultPath}`;
  if (value === ":memory:" || value === "file::memory:") return ":memory:";
  const rawPath = value.startsWith("file:") ? value.slice(5) : value;
  const path = rawPath.startsWith("/") ? rawPath : resolve(/* turbopackIgnore: true */ process.cwd(), rawPath);
  mkdirSync(dirname(path), { recursive: true });
  return `file:${path}`;
}

export function createDatabaseClient(databaseUrl?: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: toAdapterUrl(databaseUrl) });
  return new PrismaClient({ adapter });
}

const globalDatabase = globalThis as unknown as { bookmarkPrisma?: PrismaClient };
export const db = globalDatabase.bookmarkPrisma ?? createDatabaseClient();
if (process.env.NODE_ENV !== "production") globalDatabase.bookmarkPrisma = db;
