import { readEnv } from '../config/env.js';
import { migrate, openDatabase } from './database.js';

const database = openDatabase(readEnv().databasePath);
migrate(database);
database.close();
console.log('Database migrations are up to date.');
