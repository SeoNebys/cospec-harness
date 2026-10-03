import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type BookmarkDatabase = Database.Database;

export interface DatabaseOptions {
  readonly?: boolean;
  fileMustExist?: boolean;
}

export function openDatabase(databasePath: string, options: DatabaseOptions = {}): BookmarkDatabase {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath, {
    readonly: options.readonly ?? false,
    fileMustExist: options.fileMustExist ?? false,
    timeout: 5_000,
  });

  database.pragma('foreign_keys = ON');
  if (!options.readonly && databasePath !== ':memory:') {
    database.pragma('journal_mode = WAL');
  }
  database.pragma('busy_timeout = 5000');

  return database;
}

export function closeDatabase(database: BookmarkDatabase): void {
  if (database.open) database.close();
}
