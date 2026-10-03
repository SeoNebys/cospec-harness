import { loadConfig } from '../dist/server/packages/domain/src/config.js';
import { openDatabase } from '../dist/server/packages/persistence/src/database.js';
import { migrate } from '../dist/server/packages/persistence/src/migrate.js';
const config=loadConfig(),db=openDatabase(config.dbPath);migrate(db);db.close();console.log(`Migrations applied to ${config.dbPath}`);
