import path from "node:path";
import { z } from "zod";

const boolFromString = z.preprocess(
  (value) => value === true || value === "true" || value === "1",
  z.boolean()
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_PATH: z.string().default("/work/data/bookmarks.db"),
    APP_ORIGIN: z.string().url().default("http://maker:4000"),
    TRUSTED_ORIGINS: z.string().default("http://maker:4000,http://127.0.0.1:4000"),
    AUTH_BASE_URL: z.string().url().default("http://maker:4000"),
    AUTH_SECRET: z.string().min(32).default("development-secret-change-before-production"),
    MAIL_TRANSPORT: z.enum(["smtp", "console", "memory"]).default("console"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().default("Bookmarks <bookmarks@example.test>"),
    REVIEW_SEED: boolFromString.default(false),
    REVIEW_EMAIL: z.string().email().default("review@example.test"),
    REVIEW_PASSWORD: z.string().min(15).max(128).default("review-password-15"),
    REVIEW_NAME: z.string().min(1).max(80).default("Review User")
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.AUTH_SECRET.startsWith("development-")) {
      context.addIssue({ code: "custom", message: "AUTH_SECRET must be set in production" });
    }
    if (env.NODE_ENV === "production" && env.MAIL_TRANSPORT !== "smtp") {
      context.addIssue({ code: "custom", message: "Production requires SMTP mail transport" });
    }
    if (env.MAIL_TRANSPORT === "smtp" && (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD)) {
      context.addIssue({ code: "custom", message: "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required" });
    }
  });

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databasePath: string;
  appOrigin: string;
  trustedOrigins: string[];
  authBaseUrl: string;
  authSecret: string;
  mailTransport: "smtp" | "console" | "memory";
  smtp: { host?: string; port: number; user?: string; password?: string; from: string };
  review: { enabled: boolean; email: string; password: string; name: string };
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = envSchema.parse(source);
  const databasePath = env.DATABASE_PATH === ":memory:" ? env.DATABASE_PATH : path.resolve(env.DATABASE_PATH);
  if (databasePath !== ":memory:" && !databasePath.startsWith(path.resolve("/work") + path.sep)) {
    throw new Error("DATABASE_PATH must remain below /work");
  }
  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    databasePath,
    appOrigin: new URL(env.APP_ORIGIN).origin,
    trustedOrigins: [...new Set(env.TRUSTED_ORIGINS.split(",").map((value) => new URL(value.trim()).origin))],
    authBaseUrl: env.AUTH_BASE_URL,
    authSecret: env.AUTH_SECRET,
    mailTransport: env.MAIL_TRANSPORT,
    smtp: {
      ...(env.SMTP_HOST ? { host: env.SMTP_HOST } : {}),
      port: env.SMTP_PORT,
      ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
      ...(env.SMTP_PASSWORD ? { password: env.SMTP_PASSWORD } : {}),
      from: env.SMTP_FROM
    },
    review: {
      enabled: env.REVIEW_SEED,
      email: env.REVIEW_EMAIL.toLowerCase(),
      password: env.REVIEW_PASSWORD,
      name: env.REVIEW_NAME
    }
  };
}
