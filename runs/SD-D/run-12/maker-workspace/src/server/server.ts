import { createApp } from './app.js';
import { openDatabase } from './db/database.js';
import { migrateDatabase } from './db/migrate.js';

const db = openDatabase();
migrateDatabase(db);
const port = Number(process.env.PORT ?? 4000);
const server = createApp({ db }).listen(port, '0.0.0.0', () => console.log(`Bookmark Garden listening on 0.0.0.0:${port}`));
function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
