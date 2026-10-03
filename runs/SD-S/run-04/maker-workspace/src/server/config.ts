import path from 'node:path';

export type Config = {
  host: string;
  port: number;
  databasePath: string;
  production: boolean;
  sessionIdleMs: number;
  sessionAbsoluteMs: number;
};

export function loadConfig(env = process.env): Config {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 4000),
    databasePath: env.DATABASE_PATH ?? path.resolve('data/bookmarks.db'),
    production: env.NODE_ENV === 'production',
    sessionIdleMs: Number(env.SESSION_IDLE_HOURS ?? 168) * 3_600_000,
    sessionAbsoluteMs: Number(env.SESSION_ABSOLUTE_HOURS ?? 720) * 3_600_000,
  };
}
