import { migrate, dbPath } from './index.js';

migrate();
console.log(`Migrations applied to ${dbPath()}`);
