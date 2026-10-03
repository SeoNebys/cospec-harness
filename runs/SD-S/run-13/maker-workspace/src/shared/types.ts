import type { z } from 'zod';
import type { bookmarkInputSchema, bookmarkSchema, createBookmarkSchema } from './schemas.js';

export type Bookmark = z.infer<typeof bookmarkSchema>;
export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type SortOrder = 'newest' | 'oldest' | 'title';
export type MetadataWarning = 'TIMEOUT' | 'UNREACHABLE' | 'NON_HTML' | 'RESPONSE_TOO_LARGE' | 'MISSING_METADATA' | 'TOO_MANY_REDIRECTS';
export interface MetadataResult {
  requestedUrl: string; finalUrl: string; title: string; description: string | null;
  status: 'retrieved' | 'fallback'; warningCode: MetadataWarning | null;
}
export interface BookmarkList { items: Bookmark[]; total: number; tags: Array<{ name: string; count: number }> }
