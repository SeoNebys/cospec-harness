export type MetadataSource = 'remote' | 'fallback';

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TagSummary {
  name: string;
  count: number;
}

export interface MetadataPreview {
  url: string;
  normalizedUrl: string;
  title: string;
  description: string | null;
  source: MetadataSource;
  warning: string | null;
}

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_URL'
  | 'UNSAFE_URL'
  | 'DUPLICATE_URL'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ApiErrorDetail {
  code: ErrorCode;
  message: string;
  field?: string;
}

export interface ErrorEnvelope {
  error: ApiErrorDetail;
}

export interface DuplicateError extends ErrorEnvelope {
  duplicates: Bookmark[];
}

export interface BookmarkListResponse {
  items: Bookmark[];
  total: number;
}

export interface TagListResponse {
  items: TagSummary[];
}
