import { createApp } from '../../src/server/app';
import { testDatabase } from './database';

export function testApp() {
  const db = testDatabase();
  const app = createApp(db, {
    host: '127.0.0.1',
    port: 0,
    databasePath: ':memory:',
    production: false,
    sessionIdleMs: 86_400_000,
    sessionAbsoluteMs: 604_800_000,
  });
  return { app, db };
}
