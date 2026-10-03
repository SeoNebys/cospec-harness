import { z } from 'zod';

import { BOOKMARK_SORTS } from './bookmark-types.js';

const characterCount = (value: string) => Array.from(value).length;

const trimmedText = (label: string, minimum: number, maximum: number) =>
  z
    .string({ error: `${label} is required.` })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .refine((value) => characterCount(value) >= minimum, `${label} is required.`)
        .refine(
          (value) => characterCount(value) <= maximum,
          `${label} must be ${maximum.toLocaleString()} characters or fewer.`,
        ),
    );

const optionalTrimmedText = (label: string, maximum: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .refine(
          (value) => characterCount(value) <= maximum,
          `${label} must be ${maximum.toLocaleString()} characters or fewer.`,
        ),
    );

export const titleSchema = trimmedText('Title', 1, 200);

export const urlSchema = trimmedText('Web address', 1, 2048).refine((value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}, 'Enter a valid HTTP or HTTPS address.');

export const notesSchema = optionalTrimmedText('Notes', 5000);
export const tagSchema = trimmedText('Tag', 1, 40);

export const tagsSchema = z.array(tagSchema).max(20, 'Add no more than 20 tags.');

export const createBookmarkSchema = z.object({
  title: titleSchema,
  url: urlSchema,
  notes: notesSchema.default(''),
  tags: tagsSchema.default([]),
});

export const updateBookmarkSchema = z
  .object({
    title: titleSchema.optional(),
    url: urlSchema.optional(),
    notes: notesSchema.optional(),
    tags: tagsSchema.optional(),
    isFavorite: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change.');

const queryBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');

export const bookmarkQuerySchema = z.object({
  q: z.string().max(200).default(''),
  tags: z
    .string()
    .default('')
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(tagSchema).max(20)),
  favorite: queryBoolean.optional(),
  archived: queryBoolean.default(false),
  sort: z.enum(BOOKMARK_SORTS).default('newest'),
});

export const bookmarkIdSchema = z.coerce.number().int().positive();

export const bookmarkSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  url: z.string(),
  notes: z.string(),
  tags: z.array(z.string()),
  isFavorite: z.boolean(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const bookmarkListResponseSchema = z.object({
  items: z.array(bookmarkSchema),
  total: z.number().int().nonnegative(),
});

export const tagSummarySchema = z.object({
  name: z.string(),
  bookmarkCount: z.number().int().positive(),
});
