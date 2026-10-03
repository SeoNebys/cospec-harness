import { defineConfig } from "drizzle-kit";

export default defineConfig({ schema: "./lib/server/db/schema.ts", out: "./lib/server/db/migrations", dialect: "sqlite", dbCredentials: { url: process.env.DATABASE_PATH ?? "data/bookmarks.db" } });
