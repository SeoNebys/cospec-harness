import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  closeDatabase,
  openDatabase,
  type BookmarkDatabase,
} from '../../src/server/db/connection.js';
import { runMigrations } from '../../src/server/db/migrations.js';

interface TemporaryDatabaseOptions {
  migrate?: boolean;
  migrationDirectory?: string;
  now?: () => string;
}

export interface TemporaryDatabase {
  database: BookmarkDatabase;
  databasePath: string;
  directory: string;
  openConnection: (migrate?: boolean) => BookmarkDatabase;
  cleanup: () => void;
}

/**
 * Create a file-backed database in an isolated directory. Every connection
 * opened through the fixture is tracked and safely closed during cleanup.
 */
export function createTemporaryDatabase(
  options: TemporaryDatabaseOptions = {},
): TemporaryDatabase {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-manager-test-'));
  const databasePath = path.join(directory, 'bookmarks.sqlite');
  const migrationDirectory =
    options.migrationDirectory ?? path.resolve(process.cwd(), 'migrations');
  const connections = new Set<BookmarkDatabase>();

  const openConnection = (migrate = options.migrate ?? true): BookmarkDatabase => {
    const database = openDatabase(databasePath);
    connections.add(database);
    if (migrate) runMigrations(database, migrationDirectory, options.now);
    return database;
  };

  const database = openConnection();

  return {
    database,
    databasePath,
    directory,
    openConnection,
    cleanup: () => {
      for (const connection of connections) closeDatabase(connection);
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
