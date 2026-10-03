CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 254),
  email_key TEXT NOT NULL UNIQUE CHECK(email_key = lower(trim(email_key))),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash) = 64),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 4096 AND (url LIKE 'http://%' OR url LIKE 'https://%')),
  canonical_key TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 1000),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 5000),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0, 1)),
  read_later_state TEXT NOT NULL DEFAULT 'none' CHECK(read_later_state IN ('none','unread','read')),
  read_later_added_at TEXT,
  read_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, canonical_key),
  CHECK(
    (read_later_state = 'none' AND read_later_added_at IS NULL AND read_at IS NULL) OR
    (read_later_state = 'unread' AND read_later_added_at IS NOT NULL AND read_at IS NULL) OR
    (read_later_state = 'read' AND read_later_added_at IS NOT NULL AND read_at IS NOT NULL)
  )
) STRICT;
CREATE INDEX bookmarks_user_scope_idx ON bookmarks(user_id, archived_at, created_at);

CREATE TABLE bookmark_icons (
  bookmark_id TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK(media_type = 'image/png'),
  data BLOB NOT NULL CHECK(length(data) <= 262144),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 512),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 512)
) STRICT;
CREATE INDEX bookmark_icons_user_idx ON bookmark_icons(user_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
  name_key TEXT NOT NULL,
  UNIQUE(user_id, name_key)
) STRICT;

CREATE TABLE bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(bookmark_id, tag_id)
) STRICT;
