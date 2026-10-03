import path from "node:path";
import { z } from "zod";

try {
  process.loadEnvFile();
} catch {
  // Environment variables supplied by the process remain authoritative.
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_PATH: z.string().default(path.join(process.cwd(), "data", "bookmarks.sqlite")),
  BETTER_AUTH_SECRET: z.string().min(32).default("development-only-bookmark-secret-change-me"),
  BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().default(
    "http://localhost:4000,http://127.0.0.1:4000,http://maker:4000",
  ),
  REVIEW_MODE: z.enum(["0", "1"]).default("0"),
  REVIEW_USER_A_EMAIL: z.email().default("alice@example.test"),
  REVIEW_USER_A_PASSWORD: z.string().min(10).default("Bookmarks-Alice-2026!"),
  REVIEW_USER_B_EMAIL: z.email().default("bob@example.test"),
  REVIEW_USER_B_PASSWORD: z.string().min(10).default("Bookmarks-Bob-2026!"),
});

const parsed = environmentSchema.parse(process.env);

if (
  parsed.NODE_ENV === "production" &&
  parsed.BETTER_AUTH_SECRET === "development-only-bookmark-secret-change-me"
) {
  throw new Error("BETTER_AUTH_SECRET must be set to a production secret");
}

export const config = {
  ...parsed,
  trustedOrigins: parsed.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  reviewMode: parsed.REVIEW_MODE === "1",
};
