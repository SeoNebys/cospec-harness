// Shared entity and API types (source of truth for the server; mirrored in web).

export type CopyType = 'mhtml' | 'pdf';
export type CopyStatus = 'available' | 'unavailable' | 'pending';

export interface PreservedCopy {
  type: CopyType | null;
  status: CopyStatus;
  wayback_url: string | null;
}

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  description: string;
  iconUrl: string | null;
  previewImageUrl: string | null;
  note_markdown: string;
  tags: string[];
  read: boolean;
  archived: boolean;
  saved_at: string;
  updated_at: string;
  copy: PreservedCopy;
}

export interface SavedFilter {
  id: number;
  name: string;
  search_expression: string;
  includedTags: string[];
  excludedTags: string[];
}

export type SortOrder =
  | 'saved_desc'
  | 'saved_asc'
  | 'title_asc'
  | 'title_desc'
  | 'updated_desc';

export type TextSize = 'small' | 'medium' | 'large';

export interface DisplayPreferences {
  default_sort: SortOrder;
  page_size: number;
  text_size: TextSize;
}

export type ViewName = 'all' | 'readlater' | 'archive';

export interface ListQuery {
  q?: string;
  tag?: string;
  filterId?: number;
  view?: ViewName;
  sort?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface ListResult {
  items: Bookmark[];
  total: number;
  page: number;
  pageSize: number;
}
