export interface CaptureStatus {
  metadata?: 'pending' | 'ready' | 'failed';
  snapshot?: 'pending' | 'ready' | 'failed';
}

/** API-facing bookmark shape (display fields resolved). */
export interface BookmarkDTO {
  id: string;
  url: string;
  title: string; // effective (user override else captured else derived)
  titleCaptured: string | null;
  titleUser: string | null;
  description: string; // effective
  descriptionCaptured: string | null;
  descriptionUser: string | null;
  note: string | null;
  favicon: string | null;
  previewImage: string | null;
  unread: boolean;
  archived: boolean;
  tags: string[];
  snapshotKind: 'html' | 'pdf' | null;
  hasSnapshot: boolean;
  archiveOrgUrl: string | null;
  captureStatus: CaptureStatus;
  dateAdded: string;
  dateModified: string;
}
