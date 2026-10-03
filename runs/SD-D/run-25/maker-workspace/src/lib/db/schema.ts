import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export const readingStates = ["none", "unread", "read"] as const;
export type ReadingState = (typeof readingStates)[number];
export const metadataStatuses = ["complete", "partial", "failed", "not_requested"] as const;
export type MetadataStatus = (typeof metadataStatuses)[number];

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    normalizationVersion: integer("normalization_version").notNull().default(1),
    title: text("title").notNull(),
    titleUserEdited: integer("title_user_edited", { mode: "boolean" }).notNull().default(false),
    pageDescription: text("page_description"),
    descriptionUserEdited: integer("description_user_edited", { mode: "boolean" }).notNull().default(false),
    iconKey: text("icon_key"),
    noteMarkdown: text("note_markdown"),
    notePlainText: text("note_plain_text").notNull().default(""),
    readingState: text("reading_state", { enum: readingStates }).notNull().default("none"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    metadataStatus: text("metadata_status", { enum: metadataStatuses }).notNull().default("not_requested"),
    metadataFetchedAt: integer("metadata_fetched_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("bookmarks_owner_url_unique").on(table.userId, table.normalizedUrl),
    index("bookmarks_owner_archive_created_idx").on(table.userId, table.archivedAt, table.createdAt, table.id),
    index("bookmarks_owner_reading_idx").on(table.userId, table.archivedAt, table.readingState, table.createdAt, table.id),
    index("bookmarks_owner_title_idx").on(table.userId, table.title, table.id),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("tags_owner_name_unique").on(table.userId, table.normalizedName)],
);

export const bookmarkTags = sqliteTable(
  "bookmark_tags",
  {
    bookmarkId: text("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.bookmarkId, table.tagId] }), index("bookmark_tags_tag_idx").on(table.tagId, table.bookmarkId)],
);

export const iconAssets = sqliteTable("icon_assets", {
  key: text("key").primaryKey(),
  storagePath: text("storage_path").notNull(),
  byteLength: integer("byte_length").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export * from "./auth-schema";
