CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "email_verified" INTEGER DEFAULT 0 NOT NULL,
  "image" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expires_at" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token");
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session" ("user_id");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" INTEGER,
  "refresh_token_expires_at" INTEGER,
  "scope" TEXT,
  "password" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_unique" ON "account" ("provider_id", "account_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" INTEGER NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS "icon_assets" (
  "key" TEXT PRIMARY KEY NOT NULL,
  "storage_path" TEXT NOT NULL,
  "byte_length" INTEGER NOT NULL CHECK ("byte_length" >= 0 AND "byte_length" <= 262144),
  "created_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL CHECK (length("url") BETWEEN 1 AND 4096),
  "normalized_url" TEXT NOT NULL,
  "normalization_version" INTEGER DEFAULT 1 NOT NULL,
  "title" TEXT NOT NULL CHECK (length(trim("title")) BETWEEN 1 AND 500),
  "title_user_edited" INTEGER DEFAULT 0 NOT NULL,
  "page_description" TEXT CHECK ("page_description" IS NULL OR length("page_description") <= 2000),
  "description_user_edited" INTEGER DEFAULT 0 NOT NULL,
  "icon_key" TEXT REFERENCES "icon_assets"("key") ON DELETE SET NULL,
  "note_markdown" TEXT CHECK ("note_markdown" IS NULL OR length("note_markdown") <= 50000),
  "note_plain_text" TEXT DEFAULT '' NOT NULL,
  "reading_state" TEXT DEFAULT 'none' NOT NULL CHECK ("reading_state" IN ('none', 'unread', 'read')),
  "archived_at" INTEGER,
  "metadata_status" TEXT DEFAULT 'not_requested' NOT NULL CHECK ("metadata_status" IN ('complete', 'partial', 'failed', 'not_requested')),
  "metadata_fetched_at" INTEGER,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "bookmarks_owner_url_unique" ON "bookmarks" ("user_id", "normalized_url");
CREATE INDEX IF NOT EXISTS "bookmarks_owner_archive_created_idx" ON "bookmarks" ("user_id", "archived_at", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "bookmarks_owner_reading_idx" ON "bookmarks" ("user_id", "archived_at", "reading_state", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "bookmarks_owner_title_idx" ON "bookmarks" ("user_id", "title" COLLATE NOCASE, "id");

CREATE TABLE IF NOT EXISTS "tags" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "display_name" TEXT NOT NULL CHECK (length(trim("display_name")) BETWEEN 1 AND 64),
  "normalized_name" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "tags_owner_name_unique" ON "tags" ("user_id", "normalized_name");

CREATE TABLE IF NOT EXISTS "bookmark_tags" (
  "bookmark_id" TEXT NOT NULL REFERENCES "bookmarks"("id") ON DELETE CASCADE,
  "tag_id" TEXT NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("bookmark_id", "tag_id")
);
CREATE INDEX IF NOT EXISTS "bookmark_tags_tag_idx" ON "bookmark_tags" ("tag_id", "bookmark_id");

CREATE VIRTUAL TABLE IF NOT EXISTS "bookmark_search" USING fts5(
  "bookmark_id" UNINDEXED,
  "user_id" UNINDEXED,
  "title",
  "url",
  "page_description",
  "note_text",
  "tag_text",
  tokenize = 'unicode61 remove_diacritics 2'
);
