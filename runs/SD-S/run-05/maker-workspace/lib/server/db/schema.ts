import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  normalizedUrl: text("normalized_url").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
}, (t) => [uniqueIndex("bookmarks_normalized_url_unique").on(t.normalizedUrl), index("bookmarks_created_at_idx").on(t.createdAt)]);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull()
}, (t) => [uniqueIndex("tags_normalized_name_unique").on(t.normalizedName)]);

export const bookmarkTags = sqliteTable("bookmark_tags", {
  bookmarkId: text("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" })
}, (t) => [primaryKey({ columns: [t.bookmarkId, t.tagId] }), index("bookmark_tags_tag_idx").on(t.tagId), index("bookmark_tags_bookmark_idx").on(t.bookmarkId)]);
