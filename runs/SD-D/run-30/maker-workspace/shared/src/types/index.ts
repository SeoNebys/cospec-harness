export type BookmarkView = 'active' | 'favorites' | 'read-later' | 'archived';
export type BookmarkSort = 'newest' | 'oldest' | 'title';

export interface Tag { id: number; name: string }
export interface Bookmark {
  id: string; url: string; title: string; noteSource: string; tags: Tag[];
  isFavorite: boolean; isReadLater: boolean; isRead: boolean; isArchived: boolean;
  media: { iconUrl: string | null; previewUrl: string | null };
  createdAt: string; updatedAt: string;
}
export interface BookmarkInput {
  url: string; title: string; noteSource?: string; tags?: string[];
  metadataPreview?: { iconCandidate?: string | null; previewCandidate?: string | null };
}
export interface BookmarkPatch extends Partial<BookmarkInput> {
  isFavorite?: boolean; isReadLater?: boolean; isRead?: boolean; isArchived?: boolean;
}
export interface ApiProblem { code: string; message: string; issues?: Array<{ field: string; message: string; start?: number; end?: number }>; existingBookmarkId?: string }
export interface MetadataPreview { url: string; normalizedUrl: string; status: 'complete'|'partial'|'unavailable'; title: string|null; iconCandidate: string|null; previewCandidate: string|null; reasonCode: string|null }
