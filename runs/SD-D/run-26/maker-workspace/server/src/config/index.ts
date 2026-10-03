import path from 'node:path';
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true');
const schema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  BOOKMARKS_DATA_DIR: z.string().default('./data'),
  BOOKMARKS_PASSWORD_HASH: z.string().optional(),
  COOKIE_SECURE: bool,
  TRUST_PROXY: bool,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});
export type AppConfig = ReturnType<typeof loadConfig>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const v = schema.parse(env);
  if (v.NODE_ENV === 'production' && !v.BOOKMARKS_PASSWORD_HASH)
    throw new Error('BOOKMARKS_PASSWORD_HASH is required in production');
  return {
    host: v.HOST,
    port: v.PORT,
    dataDir: path.resolve(v.BOOKMARKS_DATA_DIR),
    passwordHash: v.BOOKMARKS_PASSWORD_HASH,
    developmentPassword: v.NODE_ENV === 'production' ? undefined : 'review-bookmarks',
    cookieSecure: v.COOKIE_SECURE,
    trustProxy: v.TRUST_PROXY,
    logLevel: v.LOG_LEVEL,
    production: v.NODE_ENV === 'production'
  };
}
