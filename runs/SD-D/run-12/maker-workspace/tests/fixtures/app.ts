import type { Express } from 'express';
import { createApp } from '../../src/server/app.js';
import { createTestDatabase, type TestDatabase } from './database.js';

export type TestApp = { app: Express; database: TestDatabase; cleanup: () => void };
export function createTestApp(): TestApp {
  const database = createTestDatabase();
  database.migrate();
  return { app: createApp({ db: database.db }), database, cleanup: database.cleanup };
}
