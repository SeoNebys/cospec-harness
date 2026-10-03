import { migrate, openDatabase } from '../../src/server/db/index';

export function testDatabase() {
  const db = openDatabase(':memory:');
  migrate(db);
  return db;
}
