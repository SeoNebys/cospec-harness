import { z } from 'zod';

const nullableLimited = (max: number) => z.string().max(max).nullable().optional();
export const bookmarkWriteSchema = z.object({
  url: z.string().trim().min(1).max(4096),
  title: z.string().trim().min(1).max(512),
  description: nullableLimited(2000),
  notes: nullableLimited(10000),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  isFavorite: z.boolean().default(false),
  isUnread: z.boolean().default(false),
  iconUploadToken: z.string().nullable().optional(),
}).strict();

export const bookmarkPatchSchema = z.object({
  url: z.string().trim().min(1).max(4096).optional(),
  title: z.string().trim().min(1).max(512).optional(),
  description: nullableLimited(2000),
  notes: nullableLimited(10000),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  isFavorite: z.boolean().optional(),
  isUnread: z.boolean().optional(),
  iconUploadToken: z.string().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export const metadataRequestSchema = z.object({ requestId: z.string().min(1).max(100), url: z.string().trim().min(1).max(4096) }).strict();
export const bookmarkIdSchema = z.coerce.number().int().positive();
export const listQuerySchema = z.object({
  q: z.string().max(1000).optional().default(''),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  favorite: z.enum(['true','false']).optional(),
  unread: z.enum(['true','false']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
