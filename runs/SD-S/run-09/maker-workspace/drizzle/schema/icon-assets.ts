import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const iconAssets = sqliteTable("icon_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sha256: text("sha256").notNull().unique(),
  mediaType: text("media_type", {
    enum: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/x-icon"]
  }).notNull(),
  byteSize: integer("byte_size").notNull(),
  bytes: blob("bytes", { mode: "buffer" }).notNull(),
  createdAt: integer("created_at").notNull()
});
