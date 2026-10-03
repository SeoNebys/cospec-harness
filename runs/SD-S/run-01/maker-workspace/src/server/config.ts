import path from 'node:path';

export interface AppConfig {
  databasePath: string;
  host: string;
  port: number;
}

export function getConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(environment.PORT ?? '4000');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return {
    databasePath: environment.BOOKMARK_DB_PATH ?? path.resolve('data/bookmarks.db'),
    host: '0.0.0.0',
    port,
  };
}
