import { z } from 'zod';

export const bookmarkStatusSchema = z.enum(['active', 'archived']);
export type BookmarkStatus = z.infer<typeof bookmarkStatusSchema>;

export const bookmarkInputSchema = z
  .object({
    url: z
      .string()
      .trim()
      .url()
      .max(2048)
      .refine(
        (value) => ['http:', 'https:'].includes(new URL(value).protocol),
        'Use an HTTP or HTTPS address',
      ),
    title: z.string().trim().min(1, 'Add a title').max(300),
    notes: z.string().trim().max(5000).default(''),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    isFavorite: z.boolean().default(false),
    allowDuplicate: z.boolean().default(false),
  })
  .strict();

export const titlePreviewInputSchema = z
  .object({ url: z.string().trim().url().max(2048) })
  .strict();

export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;
export type Tag = { id: string; name: string };
export type Bookmark = {
  id: string;
  url: string;
  title: string;
  notes: string;
  tags: Tag[];
  domain: string;
  isFavorite: boolean;
  status: BookmarkStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
