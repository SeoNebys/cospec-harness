import { openDatabase } from './connection.js';
import { loadConfig } from '../config.js';
const db=openDatabase(loadConfig().databasePath); db.close(); console.log('Database migrations complete');
