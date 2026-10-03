import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// FTS5 is created by the checked-in SQL migration; this declaration documents its payload.
export const bookmarkSearchPayload = sqliteTable("bookmark_search_payload", {
  bookmarkId: text("bookmark_id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  tags: text("tags").notNull()
});
