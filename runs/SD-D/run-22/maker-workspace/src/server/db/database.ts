import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeSearchText } from '../../shared/search/ast.js';
import { migrateDatabase } from './migrate.js';

export interface AppDatabase {
  readonly raw: DatabaseSync;
  transaction<T>(operation: () => T): T;
  close(): void;
}

export interface DatabaseOptions {
  path: string;
  migrationsDirectory?: string;
}

export function openDatabase(options: DatabaseOptions): AppDatabase {
  if (options.path !== ':memory:') mkdirSync(path.dirname(options.path), { recursive: true });
  const raw = new DatabaseSync(options.path);
  raw.function('search_normalize', { deterministic: true }, (value) =>
    typeof value === 'string' ? normalizeSearchText(value) : null,
  );
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec('PRAGMA busy_timeout = 5000');
  if (options.path !== ':memory:') raw.exec('PRAGMA journal_mode = WAL');

  try {
    migrateDatabase(raw, options.migrationsDirectory);
  } catch (error) {
    raw.close();
    throw error;
  }

  let closed = false;
  return {
    raw,
    transaction<T>(operation: () => T): T {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = operation();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    close(): void {
      if (!closed) {
        closed = true;
        raw.close();
      }
    },
  };
}
