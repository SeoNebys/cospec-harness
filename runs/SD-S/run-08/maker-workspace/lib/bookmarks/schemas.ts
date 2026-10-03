import { z } from "zod";

const tagSchema = z.string().trim().min(1).max(50);

export const bookmarkWriteSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  title: z.string().trim().min(1).max(300),
  titleOrigin: z.enum(["fetched", "fallback", "user"]),
  note: z.string().max(5000),
  tags: z.array(tagSchema).max(50),
  iconToken: z.string().trim().min(1).max(200).nullable().optional(),
}).strict();

export const bookmarkListQuerySchema = z.object({
  q: z.string().max(200).default(""),
  tag: z.string().max(50).optional(),
  sort: z.enum(["newest", "oldest", "alphabetical"]).default("newest"),
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const bookmarkIdSchema = z.string().uuid();
export type BookmarkWrite = z.infer<typeof bookmarkWriteSchema>;
export type BookmarkListQuery = z.infer<typeof bookmarkListQuerySchema>;
