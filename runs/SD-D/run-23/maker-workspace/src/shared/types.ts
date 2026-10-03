export type ReadState = 'unread' | 'read';
export type Location = 'active' | 'unread' | 'archive';
export type Sort = 'newest' | 'oldest' | 'title';
export type MetadataStatus = 'complete' | 'partial' | 'unavailable' | 'blocked' | 'timeout';

export interface SearchCriteria {
  query: string;
  location: Location;
  tagIds: string[];
  collectionId: string | null;
  readState: ReadState | null;
  sort: Sort;
}

export interface BookmarkDto {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string | null;
  notesMarkdown: string | null;
  siteIconAvailable: boolean;
  previewImageAvailable: boolean;
  metadataStatus: MetadataStatus;
  metadataWarnings: string[];
  tagIds: string[];
  tags: Array<{ id: string; name: string }>;
  collectionId: string | null;
  collectionName: string | null;
  readState: ReadState;
  archived: boolean;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
