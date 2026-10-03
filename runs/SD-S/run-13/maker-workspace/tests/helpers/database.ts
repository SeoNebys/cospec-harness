import { createDatabase } from '../../src/server/db/database.js';
export const testDatabase=()=>createDatabase(':memory:');
