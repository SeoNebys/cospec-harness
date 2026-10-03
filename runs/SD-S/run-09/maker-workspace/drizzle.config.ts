export default {
  dialect: "sqlite",
  schema: "./drizzle/schema/*.ts",
  out: "./drizzle/migrations",
  dbCredentials: { url: process.env.DATABASE_PATH ?? "/work/data/bookmarks.db" }
} as const;
