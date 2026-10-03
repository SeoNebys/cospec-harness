import { buildApp } from './app.js';
import { readEnv } from './config/env.js';
import { migrate, openDatabase } from './db/database.js';

const env = readEnv();
const db = openDatabase(env.databasePath);
migrate(db);
const app = await buildApp(db, env);

const close = async () => { await app.close(); db.close(); };
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
await app.listen({ host: env.host, port: env.port });
