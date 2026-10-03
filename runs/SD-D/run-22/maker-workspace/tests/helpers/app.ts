import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config.js';
import { deterministicRuntime } from './runtime.js';
import { createTemporaryDatabase, type TemporaryDatabase } from './database.js';

export interface TestApp {
  app: FastifyInstance;
  storage: TemporaryDatabase;
  close(): Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const storage = createTemporaryDatabase();
  const config: AppConfig = {
    HOST: '0.0.0.0', PORT: 4000, DATABASE_PATH: storage.path,
    ICON_CACHE_PATH: `${storage.path}-icons`, METADATA_TIMEOUT_MS: 5000,
    METADATA_HTML_MAX_BYTES: 1_048_576, METADATA_ICON_MAX_BYTES: 262_144,
    METADATA_MAX_REDIRECTS: 5, NODE_ENV: 'test',
  };
  const app = await buildApp({ config, database: storage.database, runtime: deterministicRuntime(), logger: false });
  await app.ready();
  return {
    app,
    storage,
    async close() { await app.close(); storage.cleanup(); },
  };
}
