import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://127.0.0.1:4000"),
  BETTER_AUTH_SECRET: z.string().min(32).default("development-only-secret-change-me-123456"),
  DATABASE_PATH: z.string().min(1).default("./data/bookmarks.db"),
  ICON_DIRECTORY: z.string().min(1).default("./data/icons"),
  EMAIL_TRANSPORT: z.enum(["capture", "smtp"]).default("capture"),
  ALLOW_CAPTURE_EMAIL: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().min(1).default("Safekeep <no-reply@example.test>"),
  METADATA_TIMEOUT_MS: z.coerce.number().int().min(500).max(15000).default(5000),
  METADATA_MAX_BYTES: z.coerce.number().int().min(65536).max(4194304).default(2097152),
  METADATA_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(60).default(10),
});

export type AppConfig = z.infer<typeof configSchema>;

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= configSchema.parse(process.env);
  return cached;
}

export function resetConfigForTests(): void {
  cached = undefined;
}
