import { z } from 'zod';

const nullableTrimmed = (max: number) => z.string().trim().max(max).nullable();
export const tagSchema = z.string().trim().min(1).max(40);

export const bookmarkInputSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  title: z.string().trim().min(1).max(200),
  description: nullableTrimmed(500),
  notes: nullableTrimmed(2000),
  tags: z.array(tagSchema).max(20).refine((v) => new Set(v.map((x) => x.toLocaleLowerCase())).size === v.length, 'Tags must be distinct'),
  isFavorite: z.boolean(),
});

export const createBookmarkSchema = bookmarkInputSchema.extend({ allowDuplicate: z.boolean().optional().default(false) });
export const bookmarkSchema = bookmarkInputSchema.extend({
  id: z.string().uuid(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export const bookmarkListQuerySchema = z.object({
  query: z.string().max(200).optional().default(''),
  tag: z.string().max(40).optional(),
  favorite: z.enum(['true', 'false']).optional().transform((v) => v === undefined ? undefined : v === 'true'),
  sort: z.enum(['newest', 'oldest', 'title']).optional().default('newest'),
});
export const metadataRequestSchema = z.object({ url: z.string().trim().min(1).max(2048) });
