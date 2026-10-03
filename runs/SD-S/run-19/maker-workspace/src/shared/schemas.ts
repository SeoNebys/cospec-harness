import { z } from 'zod';

export const urlInputSchema = z.string().trim().min(1, 'Enter a web address.').max(2048, 'Web addresses must be 2,048 characters or fewer.');
export const titleSchema = z.string().trim().min(1, 'A title is required.').max(300, 'Titles must be 300 characters or fewer.');
export const descriptionSchema = z
  .union([z.string().trim().max(1000, 'Descriptions must be 1,000 characters or fewer.'), z.null()])
  .transform((value) => (value === '' ? null : value));
export const tagSchema = z.string().trim().min(1).max(50, 'Tags must be 50 characters or fewer.');
export const tagsSchema = z.array(tagSchema).max(20, 'A bookmark can have at most 20 tags.');

export const metadataRequestSchema = z.object({ url: urlInputSchema }).strict();

export const metadataPreviewSchema = z
  .object({
    url: z.url(),
    normalizedUrl: z.url(),
    title: titleSchema,
    description: descriptionSchema,
    source: z.enum(['remote', 'fallback']),
    warning: z.string().nullable(),
  })
  .strict();

export const createBookmarkSchema = z
  .object({
    url: urlInputSchema,
    title: titleSchema,
    description: descriptionSchema.optional().default(null),
    tags: tagsSchema.default([]),
    allowDuplicate: z.boolean().optional().default(false),
  })
  .strict();

export const updateBookmarkSchema = z
  .object({
    url: urlInputSchema.optional(),
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    tags: tagsSchema.optional(),
    allowDuplicate: z.boolean().optional().default(false),
  })
  .strict()
  .refine(
    (value) => value.url !== undefined || value.title !== undefined || value.description !== undefined || value.tags !== undefined,
    { message: 'Provide at least one bookmark field to update.' },
  );

export const bookmarkIdSchema = z.coerce.number().int().positive();

export const bookmarkQuerySchema = z
  .object({
    q: z.string().trim().max(200, 'Search text must be 200 characters or fewer.').optional().default(''),
    tag: z.string().trim().max(50, 'Tag filters must be 50 characters or fewer.').optional().default(''),
  })
  .strict();

export const bookmarkSchema = z
  .object({
    id: z.number().int().positive(),
    url: z.url(),
    title: titleSchema,
    description: descriptionSchema,
    tags: z.array(tagSchema).max(20),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type UpdateBookmarkInput = z.infer<typeof updateBookmarkSchema>;
export type BookmarkQuery = z.infer<typeof bookmarkQuerySchema>;
