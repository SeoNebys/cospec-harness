import { dirname, isAbsolute, resolve } from 'node:path';
import type { AppConfig } from './schema.js';

export type ProductionPaths = { database: string; databaseDirectory: string; assets: string };

export function validateProduction(config: AppConfig): ProductionPaths {
  const database = resolve(config.databasePath);
  const assets = resolve(config.assetDirectory);
  if (config.nodeEnv === 'production') {
    if (!isAbsolute(config.databasePath) || !isAbsolute(config.assetDirectory))
      throw new Error('Production persistence paths must resolve to absolute locations.');
    if (config.appOrigins.size === 0)
      throw new Error('At least one production APP_ORIGINS value is required.');
  }
  return { database, databaseDirectory: dirname(database), assets };
}
