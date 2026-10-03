import { join } from 'node:path';

export interface AppConfig { host: string; port: number; databasePath: string; clientPath: string; metadataTimeoutMs: number; metadataMaxBytes: number; metadataMaxRedirects: number; }
export function getConfig(env = process.env): AppConfig {
  return {
    host: env.HOST || '0.0.0.0', port: Number(env.PORT || 4000),
    databasePath: env.DATABASE_PATH || join(process.cwd(), 'data', 'bookmarks.sqlite'),
    clientPath: env.CLIENT_PATH || join(process.cwd(), 'dist', 'client'),
    metadataTimeoutMs: 8000, metadataMaxBytes: 1024 * 1024, metadataMaxRedirects: 5,
  };
}
