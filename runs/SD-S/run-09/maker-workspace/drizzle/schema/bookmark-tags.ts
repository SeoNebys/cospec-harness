import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { bookmarks } from "./bookmarks.js";
import { tags } from "./tags.js";
import { user } from "./auth.js";

export const bookmarkTags = sqliteTable(
  "bookmark_tags",
  {
    bookmarkId: integer("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [primaryKey({ columns: [table.bookmarkId, table.tagId] })]
);
