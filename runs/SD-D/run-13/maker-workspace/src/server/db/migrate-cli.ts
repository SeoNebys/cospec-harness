import { createDatabase } from './connection.js';
import { migrate } from './migrate.js';
import { getRuntimeConfig } from '../config/runtime.js';

const config = getRuntimeConfig();
const db = createDatabase(config.databasePath);
migrate(db);
db.close();
console.log(`Migrated ${config.databasePath}`);
