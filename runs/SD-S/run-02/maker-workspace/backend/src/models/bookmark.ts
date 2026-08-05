import { z } from "zod";

/** Bookmark as returned by the API (public shape per contracts/api.md). */
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Raw persisted row (internal). tags is JSON-encoded; deletedAt drives undo. */
export interface BookmarkRow {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string | null;
  tags: string; // JSON array
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function rowToBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const tagsSchema = z.array(z.string()).max(50).optional();

export const createBookmarkSchema = z.object({
  url: z.string(),
  title: z.string().trim().max(2000).optional(),
  description: z.string().max(10000).optional(),
  tags: tagsSchema,
});

export const updateBookmarkSchema = z
  .object({
    url: z.string(),
    title: z.string().trim().max(2000),
    description: z.string().max(10000).nullable(),
    tags: z.array(z.string()).max(50),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type UpdateBookmarkInput = z.infer<typeof updateBookmarkSchema>;

export const listQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  sort: z.enum(["recent", "title"]).default("recent"),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
