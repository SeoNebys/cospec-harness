import { z } from 'zod';
import { LIMITS } from '../types/bookmark.ts';

const tagName = z.string().trim().min(1).max(LIMITS.tag);
export const bookmarkCreateSchema = z.object({
  url: z.string().trim().min(1).max(LIMITS.url),
  title: z.string().trim().max(LIMITS.title).optional(),
  description: z.string().trim().max(LIMITS.description).optional(),
  tags: z.array(tagName).max(LIMITS.tags).default([]),
  favorite: z.boolean().default(false),
}).strict();
export const bookmarkUpdateSchema = z.object({
  url: z.string().trim().min(1).max(LIMITS.url).optional(),
  title: z.string().trim().min(1).max(LIMITS.title).optional(),
  description: z.string().trim().max(LIMITS.description).nullable().optional(),
  tags: z.array(tagName).max(LIMITS.tags).optional(),
  favorite: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'Provide at least one field.');
export const metadataRequestSchema = z.object({ url: z.string().trim().min(1).max(LIMITS.url) }).strict();
export const libraryQuerySchema = z.object({
  view: z.enum(['active', 'archived']).catch('active'), q: z.string().max(LIMITS.search).catch(''),
  tag: z.union([z.string(), z.array(z.string())]).optional(), favorite: z.enum(['true', 'false']).catch('false'),
  sort: z.enum(['newest', 'oldest', 'title']).catch('newest'),
});
