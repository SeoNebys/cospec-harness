import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.js";
import { folders } from "./folders.js";
import { iconAssets } from "./icon-assets.js";

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    finalMetadataUrl: text("final_metadata_url"),
    title: text("title").notNull(),
    titleSort: text("title_sort").notNull(),
    titleSource: text("title_source", { enum: ["page", "fallback", "user"] }).notNull(),
    notes: text("notes"),
    folderId: integer("folder_id").references(() => folders.id, { onDelete: "set null" }),
    isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
    iconAssetId: integer("icon_asset_id").references(() => iconAssets.id, { onDelete: "set null" }),
    metadataStatus: text("metadata_status", { enum: ["pending", "ready", "partial", "blocked", "failed"] }).notNull(),
    metadataFailureCode: text("metadata_failure_code"),
    metadataFetchedAt: integer("metadata_fetched_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => [uniqueIndex("bookmarks_id_user_unique").on(table.id, table.userId)]
);
