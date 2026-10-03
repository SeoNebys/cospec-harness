import { loadConfig } from '../server/src/config/index.js';
import { openDatabase } from '../server/src/db/database.js';
const db = openDatabase(loadConfig().dataDir);
db.close();
console.log('Migrations applied.');
