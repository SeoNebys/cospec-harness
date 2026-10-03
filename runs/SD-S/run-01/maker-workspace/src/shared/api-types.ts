export type BookmarkStatus = 'active' | 'archived';
export type Scope = BookmarkStatus;
export type SortOrder = 'newest' | 'oldest' | 'updated' | 'title';

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  notes: string;
  tags: string[];
  isFavorite: boolean;
  status: BookmarkStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ListCriteria {
  scope: Scope;
  q: string;
  tag: string | null;
  favorite: boolean | null;
  sort: SortOrder;
}

export interface BookmarkList {
  items: Bookmark[];
  total: number;
  availableTags: string[];
  criteria: ListCriteria;
}

export interface CreateBookmarkInput {
  url: string;
  title: string;
  notes: string;
  tags: string[];
  allowDuplicate: boolean;
}

export interface UpdateBookmarkInput {
  url?: string | undefined;
  title?: string | undefined;
  notes?: string | undefined;
  tags?: string[] | undefined;
  isFavorite?: boolean | undefined;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

export interface BookmarkEnvelope {
  bookmark: Bookmark;
}
