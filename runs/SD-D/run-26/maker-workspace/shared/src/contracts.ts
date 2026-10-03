import { z } from 'zod';

export const CollectionSchema = z.enum(['active', 'unread', 'archive']);
export const SortSchema = z.enum(['recent', 'title']);
export const TagNameSchema = z.string().trim().min(1).max(100);
export const BookmarkFieldsSchema = z.object({
  url: z.string().trim().min(1),
  title: z.string().max(300).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  noteMarkdown: z.string().max(50000).default(''),
  tags: z.array(TagNameSchema).max(100).default([]),
  isRead: z.boolean().default(false),
  proposalToken: z.string().optional(),
  acceptIcon: z.boolean().optional()
});
export const BookmarkCreateSchema = BookmarkFieldsSchema;
export const BookmarkUpdateSchema = z.object({
  url: z.string().trim().min(1).optional(),
  title: z.string().max(300).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  noteMarkdown: z.string().max(50000).optional(),
  tags: z.array(TagNameSchema).max(100).optional(),
  isRead: z.boolean().optional(),
  archived: z.boolean().optional(),
  iconChoice: z.enum(['automatic', 'removed', 'imported']).optional(),
  iconAssetToken: z.string().max(512).nullable().optional(),
  removeIcon: z.boolean().optional()
});
export const BulkRequestSchema = z.object({
  selection: z.union([
    z.object({ ids: z.array(z.string().uuid()).min(1) }),
    z.object({
      allMatching: z.literal(true),
      collection: CollectionSchema,
      query: z.string().default(''),
      tag: z.string().optional(),
      sort: SortSchema.default('recent'),
      queryFingerprint: z.string().min(16),
      excludeIds: z.array(z.string().uuid()).max(1000).default([])
    })
  ]),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('addTags'), tags: z.array(TagNameSchema).min(1) }),
    z.object({ type: z.literal('removeTags'), tags: z.array(TagNameSchema).min(1) }),
    z.object({ type: z.literal('markRead'), value: z.boolean() }),
    z.object({ type: z.literal('archive') }),
    z.object({ type: z.literal('restore') }),
    z.object({ type: z.literal('delete'), confirm: z.literal('permanent') })
  ])
});
export type BookmarkCreate = z.infer<typeof BookmarkCreateSchema>;
export type BookmarkUpdate = z.infer<typeof BookmarkUpdateSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type Bookmark = {
  id: string;
  url: string;
  title: string | null;
  displayLabel: string;
  description: string | null;
  noteMarkdown: string;
  tags: { id: string; name: string }[];
  isRead: boolean;
  archivedAt: string | null;
  iconUrl: string | null;
  iconChoice: 'automatic' | 'removed' | 'imported';
  metadataStatus: string;
  createdAt: string;
  updatedAt: string;
};
export type MetadataProposal = {
  requestId: string;
  url: string;
  title: string | null;
  description: string | null;
  iconUrl: string | null;
  proposalToken?: string;
  status: 'complete' | 'partial' | 'unavailable' | 'blocked';
  message?: string;
  duplicate?: { id: string; title: string };
};
