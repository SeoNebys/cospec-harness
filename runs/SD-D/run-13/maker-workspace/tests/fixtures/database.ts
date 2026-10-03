import { createDatabase } from '../../src/server/db/connection.js';
import { migrate } from '../../src/server/db/migrate.js';
export function createTestDatabase() { const db = createDatabase(':memory:'); migrate(db, 1_700_000_000_000); return db; }
