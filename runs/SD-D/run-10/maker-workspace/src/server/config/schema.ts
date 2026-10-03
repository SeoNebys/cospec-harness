import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_PATH: z.string().min(1).default('./data/bookmarks.sqlite'),
  ASSET_DIRECTORY: z.string().min(1).default('./data/assets'),
  APP_ORIGINS: z
    .string()
    .default('http://maker:4000,http://127.0.0.1:4000,http://localhost:4000,http://localhost:5173'),
  SESSION_SECRET: z.string().min(32).default('development-only-secret-change-before-prod'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  RESET_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  MAIL_TRANSPORT: z.enum(['log', 'smtp']).default('log'),
  SMTP_URL: z.string().optional(),
  TRUST_PROXY: booleanString,
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databasePath: string;
  assetDirectory: string;
  appOrigins: Set<string>;
  sessionSecret: string;
  sessionDays: number;
  resetMinutes: number;
  mailTransport: 'log' | 'smtp';
  smtpUrl?: string;
  trustProxy: boolean;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(source);
  if (parsed.NODE_ENV === 'production' && parsed.SESSION_SECRET.startsWith('development-only')) {
    throw new Error('SESSION_SECRET must be configured for production');
  }
  if (parsed.NODE_ENV === 'production' && parsed.MAIL_TRANSPORT === 'log') {
    throw new Error('MAIL_TRANSPORT=log is not allowed in production');
  }
  if (parsed.MAIL_TRANSPORT === 'smtp' && !parsed.SMTP_URL) {
    throw new Error('SMTP_URL is required when MAIL_TRANSPORT=smtp');
  }
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databasePath: parsed.DATABASE_PATH,
    assetDirectory: parsed.ASSET_DIRECTORY,
    appOrigins: new Set(
      parsed.APP_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
    sessionSecret: parsed.SESSION_SECRET,
    sessionDays: parsed.SESSION_DAYS,
    resetMinutes: parsed.RESET_MINUTES,
    mailTransport: parsed.MAIL_TRANSPORT,
    smtpUrl: parsed.SMTP_URL,
    trustProxy: parsed.TRUST_PROXY,
  };
}
