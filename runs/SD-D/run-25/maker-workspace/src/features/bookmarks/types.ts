import type { MetadataStatus, ReadingState } from "@/lib/db/schema";

export type Bookmark = {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  pageDescription: string | null;
  iconKey: string | null;
  iconUrl: string;
  noteMarkdown: string | null;
  readingState: ReadingState;
  archived: boolean;
  archivedAt: string | null;
  metadataStatus: MetadataStatus;
  metadataFetchedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  domain: string;
};

export type CollectionView = "active" | "unread" | "archive";
export type SortOrder = "newest" | "oldest" | "title";
