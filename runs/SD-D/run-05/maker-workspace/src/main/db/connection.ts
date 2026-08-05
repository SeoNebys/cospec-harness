import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { applySchema } from './schema'
import { runMigrations } from './migrations/index'

export type DB = Database.Database

// Opens (creating if needed) the local SQLite database file at `dbPath`,
// applies the schema, and runs any pending migrations. Everything stays on the
// user's device — there is no server or network involved here.
export function openDatabase(dbPath: string): DB {
  if (dbPath !== ':memory:') {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applySchema(db)
  runMigrations(db)
  return db
}
