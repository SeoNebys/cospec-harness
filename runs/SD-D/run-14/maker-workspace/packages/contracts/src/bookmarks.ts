export type ReadState = 'read' | 'unread';
export type CaptureStatus = 'pending' | 'complete' | 'partial' | 'failed';

export interface Tag { id: string; name: string; usageCount: number }
export interface Snapshot {
  status: CaptureStatus;
  available: boolean;
  assetUrl: string | null;
  capturedAt: string | null;
  capturedUrl: string | null;
  limitationCode: string | null;
  message: string | null;
  refreshStatus: 'pending' | 'failed' | null;
}
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string | null;
  notes: string | null;
  faviconUrl: string | null;
  previewUrl: string | null;
  tags: Tag[];
  isFavorite: boolean;
  readState: ReadState;
  archiveState: 'active' | 'archived';
  metadataStatus: CaptureStatus;
  metadataErrorCode: string | null;
  snapshot: Snapshot;
  createdAt: string;
  updatedAt: string;
}
export interface CreateBookmark {
  url: string; title?: string; description?: string; notes?: string; tags?: string[];
  isFavorite?: boolean; readState?: ReadState;
}
export interface UpdateBookmark extends Partial<Omit<CreateBookmark, 'url'>> {
  url?: string; archiveState?: 'active' | 'archived';
}
