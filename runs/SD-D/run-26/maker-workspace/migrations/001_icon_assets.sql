CREATE TABLE icon_assets (
  hash TEXT PRIMARY KEY COLLATE BINARY CHECK(hash GLOB '[0-9a-f]*' AND length(hash)=64),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/webp')),
  bytes BLOB NOT NULL,
  byte_count INTEGER NOT NULL CHECK(byte_count > 0 AND byte_count <= 524288 AND byte_count=length(bytes)),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 512),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 512),
  created_at TEXT NOT NULL
) STRICT;
