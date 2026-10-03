import path from 'node:path';

export interface AppConfig {
  host: string;
  port: number;
  databasePath: string;
  nodeEnv: string;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') return 4000;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    host: env.HOST?.trim() || '0.0.0.0',
    port: parsePort(env.PORT),
    databasePath: path.resolve(env.DATABASE_PATH?.trim() || 'data/bookmarks.sqlite'),
    nodeEnv: env.NODE_ENV?.trim() || 'development',
  };
}
