import { resolve } from 'node:path';

export interface RuntimeConfig {
  host: string;
  port: number;
  dataDir: string;
  databasePath: string;
  logLevel: string;
  isProduction: boolean;
}

export function getRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const dataDir = resolve(env.BOOKMARK_DATA_DIR || resolve(process.cwd(), 'data'));
  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be valid');
  return {
    host: env.HOST || '0.0.0.0',
    port,
    dataDir,
    databasePath: resolve(dataDir, 'bookmarks.sqlite3'),
    logLevel: env.LOG_LEVEL || 'info',
    isProduction: env.NODE_ENV === 'production',
  };
}
