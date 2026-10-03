import { loadConfig } from '../config/schema.js';
import { openDatabase } from './database.js';
import { runMigrations } from './migration-runner.js';

export function migrateConfiguredDatabase(): string[] {
  const config = loadConfig();
  const database = openDatabase(config.databasePath);
  try {
    return runMigrations(database);
  } finally {
    database.close();
  }
}
