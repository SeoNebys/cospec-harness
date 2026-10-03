import { z } from 'zod';
import { publicIdSchema } from '../schemas/common.js';

export const searchCriteriaSchema = z.object({
  query: z.string().max(2000).default(''),
  includeTagIds: z.array(publicIdSchema).max(50).default([]),
  excludeTagIds: z.array(publicIdSchema).max(50).default([]),
  collection: z
    .discriminatedUnion('mode', [
      z.object({ mode: z.literal('any') }),
      z.object({ mode: z.literal('unfiled') }),
      z.object({ mode: z.literal('id'), id: publicIdSchema }),
    ])
    .default({ mode: 'any' }),
  favorite: z.enum(['any', 'favorite', 'not_favorite']).default('any'),
  reading: z.enum(['any', 'none', 'unread', 'read']).default('any'),
  context: z.enum(['active', 'archive']).default('active'),
  sort: z.enum(['newest', 'oldest', 'title', 'updated']).default('newest'),
});

export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;

export const bookmarkListQuerySchema = z.object({
  query: z.string().max(2000).default(''),
  includeTag: z.union([publicIdSchema, z.array(publicIdSchema)]).optional(),
  excludeTag: z.union([publicIdSchema, z.array(publicIdSchema)]).optional(),
  collection: z.string().default('any'),
  favorite: z.enum(['any', 'favorite', 'not_favorite']).default('any'),
  reading: z.enum(['any', 'none', 'unread', 'read']).default('any'),
  context: z.enum(['active', 'archive']).default('active'),
  sort: z.enum(['newest', 'oldest', 'title', 'updated']).default('newest'),
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function listQueryToCriteria(input: z.infer<typeof bookmarkListQuerySchema>): SearchCriteria {
  const array = (value: string | string[] | undefined) =>
    value ? (Array.isArray(value) ? value : [value]) : [];
  return {
    query: input.query,
    includeTagIds: array(input.includeTag),
    excludeTagIds: array(input.excludeTag),
    collection:
      input.collection === 'any' || input.collection === 'unfiled'
        ? { mode: input.collection }
        : { mode: 'id', id: input.collection },
    favorite: input.favorite,
    reading: input.reading,
    context: input.context,
    sort: input.sort,
  };
}
