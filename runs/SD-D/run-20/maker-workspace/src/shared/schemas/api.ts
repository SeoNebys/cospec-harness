import { z } from 'zod';
import { noteDocumentSchema } from './noteDocument.js';

export const readingStateSchema = z.enum(['none', 'unread', 'read']);
export const lifecycleStateSchema = z.enum(['active', 'archived']);
export const metadataStatusSchema = z.enum(['complete', 'partial', 'failed', 'skipped', 'fallback']);
export const tagLabelSchema = z.string().trim().min(1).max(30);
export const urlInputSchema = z.string().trim().min(1).max(2048);

export const createPreviewSchema = z.object({ url: urlInputSchema }).strict();

export const createBookmarkSchema = z
  .object({
    url: urlInputSchema,
    metadataPreviewId: z.uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(500).nullable().optional(),
    noteDocument: noteDocumentSchema.nullable().optional(),
    tagLabels: z.array(tagLabelSchema).max(20).default([]),
    readingState: readingStateSchema.default('none'),
  })
  .strict()
  .superRefine(uniqueTags);

export const updateBookmarkSchema = z
  .object({
    url: urlInputSchema.optional(),
    metadataPreviewId: z.uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(500).nullable().optional(),
    noteDocument: noteDocumentSchema.nullable().optional(),
    tagLabels: z.array(tagLabelSchema).max(20).optional(),
    readingState: readingStateSchema.optional(),
    lifecycleState: lifecycleStateSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one change is required.')
  .superRefine((value, context) => {
    if (value.metadataPreviewId && !value.url) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'A URL is required with a metadata preview.',
      });
    }
    if (value.tagLabels) uniqueTags(value, context);
  });

export const listBookmarksQuerySchema = z.object({
  view: z.enum(['active', 'unread', 'archived']).default('active'),
  q: z.string().max(500).default(''),
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (value == null ? [] : Array.isArray(value) ? value : [value])),
  sort: z.enum(['savedAt', 'title']).default('savedAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const bulkAction = z.enum([
  'addTags',
  'removeTags',
  'markRead',
  'markUnread',
  'archive',
  'restore',
  'delete',
]);
export const bulkActionSchema = z
  .object({
    bookmarkIds: z.array(z.uuid()).min(1).max(100),
    action: bulkAction,
    tagLabels: z.array(tagLabelSchema).min(1).max(20).optional(),
    confirmed: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.bookmarkIds).size !== value.bookmarkIds.length)
      context.addIssue({ code: 'custom', path: ['bookmarkIds'], message: 'Bookmark IDs must be unique.' });
    const usesTags = value.action === 'addTags' || value.action === 'removeTags';
    if (usesTags && !value.tagLabels?.length)
      context.addIssue({
        code: 'custom',
        path: ['tagLabels'],
        message: 'Tags are required for this action.',
      });
    if (!usesTags && value.tagLabels)
      context.addIssue({
        code: 'custom',
        path: ['tagLabels'],
        message: 'Tags are not valid for this action.',
      });
    if (value.action === 'delete' && value.confirmed !== true)
      context.addIssue({
        code: 'custom',
        path: ['confirmed'],
        message: 'Permanent deletion must be explicitly confirmed.',
      });
  });

function uniqueTags(value: { tagLabels?: string[] }, context: z.RefinementCtx): void {
  const labels = value.tagLabels ?? [];
  const normalized = labels.map((label) =>
    label.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase(),
  );
  if (new Set(normalized).size !== labels.length)
    context.addIssue({ code: 'custom', path: ['tagLabels'], message: 'Tags must be unique.' });
}

export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type UpdateBookmarkInput = z.infer<typeof updateBookmarkSchema>;
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
export type ListBookmarksQuery = z.infer<typeof listBookmarksQuerySchema>;

export interface TagDto {
  id: string;
  label: string;
}
export interface BookmarkDto {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string | null;
  noteDocument: z.infer<typeof noteDocumentSchema> | null;
  tags: TagDto[];
  lifecycleState: 'active' | 'archived';
  readingState: 'none' | 'unread' | 'read';
  metadataStatus: 'complete' | 'partial' | 'failed' | 'skipped' | 'fallback';
  iconUrl: string | null;
  previewImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
