import { z } from "zod";

export const tagNameSchema = z.string().trim().min(1).max(40);
export const bookmarkInputSchema = z.object({
  url: z.string().trim().min(1).max(4096),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(300).nullable().optional(),
  tags: z.array(tagNameSchema).max(20).default([])
}).strict();

export const bookmarkSchema = bookmarkInputSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const bookmarkListSchema = z.object({ bookmarks: z.array(bookmarkSchema), total: z.number().int().nonnegative() });
export const tagSummarySchema = z.object({ name: tagNameSchema, count: z.number().int().positive() });
export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;
export type Bookmark = z.infer<typeof bookmarkSchema>;
export type TagSummary = z.infer<typeof tagSummarySchema>;
