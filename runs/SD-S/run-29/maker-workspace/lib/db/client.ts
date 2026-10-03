import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { pglite?: PGlite; migrated?: Promise<void> };
const path = process.env.DATABASE_PATH || "data/kept-db";
mkdirSync(dirname(path), { recursive: true });
export const client = globalDb.pglite ?? new PGlite(path);
if (process.env.NODE_ENV !== "production") globalDb.pglite = client;

export const db = drizzle(client, { schema });

const migrationSql = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY, token_hash text NOT NULL UNIQUE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS bookmarks (
  id text PRIMARY KEY, owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  url text NOT NULL CHECK (char_length(url) BETWEEN 1 AND 2048), normalized_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, normalized_url)
);
CREATE INDEX IF NOT EXISTS bookmarks_owner_created_idx ON bookmarks(owner_id, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS tags (
  id text PRIMARY KEY, owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50), normalized_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id, normalized_name)
);
CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id text NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id text NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(bookmark_id, tag_id)
);
CREATE INDEX IF NOT EXISTS bookmark_tags_tag_idx ON bookmark_tags(tag_id, bookmark_id);
`;

export async function ensureDatabase() {
  globalDb.migrated ??= client.exec(migrationSql).then(() => undefined);
  return globalDb.migrated;
}
