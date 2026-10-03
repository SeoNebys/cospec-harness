export const BOOKMARK_SORTS = ['newest', 'oldest', 'title', 'updated'] as const;

export type BookmarkSort = (typeof BOOKMARK_SORTS)[number];

export interface Bookmark {
  id: number;
  title: string;
  url: string;
  notes: string;
  tags: string[];
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookmarkInput {
  title: string;
  url: string;
  notes: string;
  tags: string[];
}

export interface UpdateBookmarkInput {
  title?: string;
  url?: string;
  notes?: string;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
}

export interface BookmarkQuery {
  q: string;
  tags: string[];
  favorite?: boolean;
  archived: boolean;
  sort: BookmarkSort;
}

export interface TagSummary {
  name: string;
  bookmarkCount: number;
}

export interface BookmarkListResponse {
  items: Bookmark[];
  total: number;
}

export type ApiErrorCode =
  'VALIDATION_ERROR' | 'INVALID_QUERY' | 'DUPLICATE_URL' | 'NOT_FOUND' | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
    existingBookmarkId?: number;
  };
}
