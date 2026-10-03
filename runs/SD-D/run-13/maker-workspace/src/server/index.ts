import { buildApp } from './app.js';
import { getRuntimeConfig } from './config/runtime.js';
import { createDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { backupDatabase } from './db/backup.js';
import { scheduleMetadataCleanup } from './media/cleanup.js';

const config = getRuntimeConfig();
const db = createDatabase(config.databasePath);
migrate(db);
const app = await buildApp({ db }, { level: config.logLevel, redact: { paths: ['req.headers.authorization','req.headers.cookie','req.body.notes','req.body.url'], censor: '[redacted]' } });
const cleanupTimer = scheduleMetadataCleanup(db);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => { clearInterval(cleanupTimer); await app.close(); try { await backupDatabase(db,config.dataDir); } finally { db.close(); } process.exit(0); });
}

await app.listen({ host: config.host, port: config.port });
