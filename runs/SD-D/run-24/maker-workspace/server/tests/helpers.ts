import Database from 'better-sqlite3';
import { setDbForTesting } from '../src/db/connection';
import { migrate } from '../src/db/migrate';

/** Create a fresh in-memory database registered as the active connection. */
export function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  setDbForTesting(db);
  return db;
}
