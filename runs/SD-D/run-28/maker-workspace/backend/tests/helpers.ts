import { buildApp } from '../src/server.ts';
import { getDb } from '../src/db/db.ts';

/** Build an app backed by a fresh in-memory database (no static serving). */
export function makeApp() {
  const db = getDb(':memory:');
  return buildApp({ db, serveStatic: false, logger: false });
}
