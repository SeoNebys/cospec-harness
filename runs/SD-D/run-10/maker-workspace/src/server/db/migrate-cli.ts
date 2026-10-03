import { migrateConfiguredDatabase } from './migrate.js';

const completed = migrateConfiguredDatabase();
console.log(completed.length ? `Applied: ${completed.join(', ')}` : 'Database is up to date.');
