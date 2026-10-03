import { z } from "zod";

const schema = z.object({
  APP_BASE_URL: z.string().url().default("http://maker:4000"),
  BETTER_AUTH_SECRET: z.string().min(32).default("local-development-secret-change-me-123456"),
  DATABASE_PATH: z.string().min(1).default("/work/data/bookmarks.db"),
  MAIL_TRANSPORT: z.enum(["memory", "smtp"]).default("memory"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("bookmarks@example.com"),
  TRUSTED_ORIGIN: z.string().url().default("http://maker:4000"),
  SEED_REVIEW_USER: z.enum(["true", "false"]).default("false"),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | undefined;

export function env(): AppEnv {
  cached ??= schema.parse(process.env);
  return cached;
}

export function resetEnvForTests(): void {
  cached = undefined;
}
