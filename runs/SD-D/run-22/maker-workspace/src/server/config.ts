import path from 'node:path';
import { z } from 'zod';

const EnvironmentSchema = z.object({
  HOST: z.literal('0.0.0.0').default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_PATH: z.string().min(1).default(path.resolve('data/bookmarks.sqlite')),
  ICON_CACHE_PATH: z.string().min(1).default(path.resolve('data/icons')),
  METADATA_TIMEOUT_MS: z.coerce.number().int().positive().max(5_000).default(5_000),
  METADATA_HTML_MAX_BYTES: z.coerce.number().int().positive().max(1_048_576).default(1_048_576),
  METADATA_ICON_MAX_BYTES: z.coerce.number().int().positive().max(262_144).default(262_144),
  METADATA_MAX_REDIRECTS: z.coerce.number().int().min(0).max(5).default(5),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type AppConfig = z.infer<typeof EnvironmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return EnvironmentSchema.parse(environment);
}
