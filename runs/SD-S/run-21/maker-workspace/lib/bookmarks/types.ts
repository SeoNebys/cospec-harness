export type ReadingStatus = "to_read" | "read";
export type Scope = "active" | "to_read" | "favorites" | "archived";
export type Sort = "created_desc" | "title_asc" | "updated_desc";

export interface Tag {
  id: string;
  name: string;
  bookmarkCount?: number;
}
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string | null;
  notes: string | null;
  siteIconUrl: string | null;
  previewImageUrl: string | null;
  favorite: boolean;
  readingStatus: ReadingStatus;
  archived: boolean;
  archivedAt: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}
export interface BookmarkInput {
  url: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  siteIconUrl?: string | null;
  previewImageUrl?: string | null;
  favorite?: boolean;
  readingStatus?: ReadingStatus;
  tags?: string[];
  allowDuplicate?: boolean;
}
export interface BookmarkQuery {
  scope: Scope;
  q?: string;
  tag?: string;
  favorite?: boolean;
  readingStatus?: ReadingStatus;
  sort: Sort;
  page: number;
  pageSize: number;
}
export interface MetadataPreview {
  requestedUrl: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  siteIconUrl: string | null;
  previewImageUrl: string | null;
  warnings: string[];
}
