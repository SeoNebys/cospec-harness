import { openDatabase } from '../../src/db/connection.js';
export const testDatabase=()=>openDatabase(':memory:');
