import { z } from 'zod';
import { expectedVersionSchema, publicIdSchema } from '../schemas/common.js';

export const bookmarkUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .refine((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Enter a valid http or https address without embedded credentials.');

export const bookmarkCreateSchema = z.object({
  url: bookmarkUrlSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(1000).nullable().optional(),
  noteMarkdown: z.string().max(100_000).nullable().optional(),
  faviconAssetId: publicIdSchema.nullable().optional(),
  previewAssetId: publicIdSchema.nullable().optional(),
  tagIds: z.array(publicIdSchema).max(50).default([]),
  newTagNames: z.array(z.string()).max(50).default([]),
  collectionId: publicIdSchema.nullable().optional(),
  isFavorite: z.boolean().default(false),
  readingState: z.enum(['none', 'unread', 'read']).default('none'),
});

export const bookmarkPatchSchema = bookmarkCreateSchema.partial().extend({
  expectedVersion: expectedVersionSchema,
});

export const bookmarkStateSchema = z.object({ expectedVersion: expectedVersionSchema });
export const permanentDeleteSchema = z.object({
  expectedVersion: expectedVersionSchema,
  confirmation: z.literal('permanent'),
});

export type BookmarkCreateInput = z.infer<typeof bookmarkCreateSchema>;
export type BookmarkPatchInput = z.infer<typeof bookmarkPatchSchema>;

export type MediaSummary = { id: string; url: string };
export type BookmarkDetail = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  noteMarkdown: string | null;
  notePlain: string | null;
  favicon: MediaSummary | null;
  previewImage: MediaSummary | null;
  tags: Array<{ id: string; name: string }>;
  collection: { id: string; name: string } | null;
  isFavorite: boolean;
  readingState: 'none' | 'unread' | 'read';
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};
