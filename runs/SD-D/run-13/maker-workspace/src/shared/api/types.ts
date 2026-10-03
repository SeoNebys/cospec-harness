export type CollectionView = 'active' | 'to-read' | 'archive';
export type SortField = 'title' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface TagDto { id: number; name: string }
export interface RichTextMark { type: 'bold' | 'italic' | 'link'; attrs?: { href?: string } }
export interface RichTextNode {
  type: 'doc' | 'paragraph' | 'heading' | 'text' | 'bulletList' | 'orderedList' | 'listItem' | 'blockquote' | 'hardBreak';
  text?: string;
  attrs?: { level?: 2 | 3 };
  marks?: RichTextMark[];
  content?: RichTextNode[];
}
export type RichTextDocument = RichTextNode & { type: 'doc'; content: RichTextNode[] };

export interface BookmarkSummary {
  id: string; url: string; title: string; description: string | null;
  iconAssetUrl: string | null; previewAssetUrl: string | null; tags: TagDto[];
  favorite: boolean; toRead: boolean; archivedAt: string | null;
  createdAt: string; updatedAt: string;
}
export interface Bookmark extends BookmarkSummary {
  notes: RichTextDocument;
  metadataRefreshedAt: string | null;
}
export interface BookmarkPage {
  items: BookmarkSummary[]; total: number; page: number; pageSize: number;
  sortField: SortField; sortDirection: SortDirection;
}
export interface DuplicateTarget { id: string; title: string; archived: boolean }
export interface ApiError { code: string; message: string; fieldErrors?: Record<string, string[]> }
export interface SearchSyntaxApiError extends ApiError { query: string; start: number; end: number }
export interface Preferences { sortField: SortField; sortDirection: SortDirection }
