import { z } from 'zod';
import { bookmarkUrlSchema } from './bookmarks.js';

export const metadataPreviewSchema = z.object({ url: bookmarkUrlSchema });
export const mediaCaptureSchema = z.object({
  purpose: z.enum(['favicon', 'preview']),
  url: bookmarkUrlSchema,
});

export type MetadataSource =
  | 'open_graph'
  | 'twitter_card'
  | 'html_title'
  | 'meta_description'
  | 'link_icon'
  | 'favicon_fallback'
  | 'host_fallback';

export type MetadataField<T> = { value: T | null; source: MetadataSource; fallback?: boolean };
