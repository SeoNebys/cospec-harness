export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string | null;
  iconUrl: string | null;
  notes: string | null;
  tags: string[];
  readLater: boolean;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  existingId?: string;
  span?: { start: number; end: number };
}

export interface MetadataPreview {
  requestedUrl: string;
  finalUrl: string | null;
  outcome: 'complete' | 'partial' | 'failed';
  fields: {
    title: { status: string; value?: string | null; source?: string | null };
    description: { status: string; value?: string | null; source?: string | null };
    icon: { status: string; value?: string | null; source?: string | null };
  };
  iconToken?: string | null;
  warnings: string[];
}

export interface BookmarkDraft {
  url: string;
  title: string;
  description: string | null;
  notes: string | null;
  tags: string[];
  readLater: boolean;
  iconToken?: string | null;
}

export type SortField = 'createdAt' | 'title';
export type SortOrder = 'asc' | 'desc';
