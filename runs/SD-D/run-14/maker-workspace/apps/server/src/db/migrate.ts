import { createDatabase } from './client.js';
import { loadConfig } from '../config.js';
const db = createDatabase(loadConfig()); db.close();
