import path from 'node:path';
export interface Config { host: string; port: number; dataDir: string; databasePath: string; production: boolean }
export function getConfig(overrides: Partial<Config> = {}): Config {
  const dataDir = overrides.dataDir ?? process.env.BOOKMARK_DATA_DIR ?? path.resolve('data');
  return { host: overrides.host ?? process.env.HOST ?? '0.0.0.0', port: overrides.port ?? Number(process.env.PORT ?? 4000), dataDir, databasePath: overrides.databasePath ?? path.join(dataDir, 'bookmarks.sqlite'), production: overrides.production ?? process.env.NODE_ENV === 'production' };
}
