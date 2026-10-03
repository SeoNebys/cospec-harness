PRAGMA foreign_keys=ON;

CREATE TABLE "Bookmark" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "url" TEXT NOT NULL,
  "urlKey" TEXT NOT NULL,
  "urlSearch" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "titleSearch" TEXT NOT NULL,
  "titleOrigin" TEXT NOT NULL CHECK ("titleOrigin" IN ('fetched', 'fallback', 'user')),
  "note" TEXT NOT NULL DEFAULT '',
  "noteSearch" TEXT NOT NULL DEFAULT '',
  "iconAsset" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Bookmark_urlKey_key" ON "Bookmark"("urlKey");
CREATE INDEX "Bookmark_createdAt_id_idx" ON "Bookmark"("createdAt", "id");
CREATE INDEX "Bookmark_titleSearch_id_idx" ON "Bookmark"("titleSearch", "id");

CREATE TABLE "Tag" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL
);
CREATE UNIQUE INDEX "Tag_nameKey_key" ON "Tag"("nameKey");

CREATE TABLE "BookmarkTag" (
  "bookmarkId" TEXT NOT NULL,
  "tagId" INTEGER NOT NULL,
  CONSTRAINT "BookmarkTag_bookmarkId_fkey" FOREIGN KEY ("bookmarkId") REFERENCES "Bookmark"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookmarkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("bookmarkId", "tagId")
);
CREATE INDEX "BookmarkTag_tagId_bookmarkId_idx" ON "BookmarkTag"("tagId", "bookmarkId");
