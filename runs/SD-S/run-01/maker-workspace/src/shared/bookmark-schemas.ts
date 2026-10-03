import { z } from 'zod';

const httpUrl = z
  .string()
  .trim()
  .min(1, 'Enter a web address.')
  .max(2048, 'Web addresses must be 2,048 characters or fewer.')
  .superRefine((value, context) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        context.addIssue({ code: 'custom', message: 'Use an address beginning with http:// or https://.' });
      }
    } catch {
      context.addIssue({ code: 'custom', message: 'Enter a complete web address, such as https://example.com.' });
    }
  });

export const tagNameSchema = z.string().trim().min(1, 'Tags cannot be blank.').max(40, 'Tags must be 40 characters or fewer.');

export const bookmarkSchema = z
  .object({
    id: z.uuid(),
    url: httpUrl,
    title: z.string().trim().min(1).max(300),
    notes: z.string().trim().max(10_000),
    tags: z.array(tagNameSchema).max(20),
    isFavorite: z.boolean(),
    status: z.enum(['active', 'archived']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const createBookmarkSchema = z
  .object({
    url: httpUrl,
    title: z.string().trim().min(1, 'Enter a title.').max(300, 'Titles must be 300 characters or fewer.'),
    notes: z.string().trim().max(10_000, 'Notes must be 10,000 characters or fewer.').default(''),
    tags: z.array(tagNameSchema).max(20, 'Use no more than 20 tags.').default([]),
    allowDuplicate: z.boolean().default(false),
  })
  .strict();

export const updateBookmarkSchema = z
  .object({
    url: httpUrl.optional(),
    title: z.string().trim().min(1, 'Enter a title.').max(300, 'Titles must be 300 characters or fewer.').optional(),
    notes: z.string().trim().max(10_000, 'Notes must be 10,000 characters or fewer.').optional(),
    tags: z.array(tagNameSchema).max(20, 'Use no more than 20 tags.').optional(),
    isFavorite: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one change.' });

const queryBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}, z.boolean().optional());

export const listCriteriaSchema = z
  .object({
    scope: z.enum(['active', 'archived']).default('active'),
    q: z.string().trim().max(200, 'Search must be 200 characters or fewer.').default(''),
    tag: z.string().trim().min(1).max(40).optional(),
    favorite: queryBoolean,
    sort: z.enum(['newest', 'oldest', 'updated', 'title']).default('newest'),
  })
  .strict()
  .transform((value) => ({
    scope: value.scope,
    q: value.q,
    tag: value.tag ?? null,
    favorite: value.favorite ?? null,
    sort: value.sort,
  }));

export const bookmarkIdSchema = z.uuid('Bookmark ID must be a UUID.');

export type ParsedCreateBookmark = z.output<typeof createBookmarkSchema>;
export type ParsedUpdateBookmark = z.output<typeof updateBookmarkSchema>;
export type ParsedListCriteria = z.output<typeof listCriteriaSchema>;
