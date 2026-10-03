import { z } from 'zod';
import { expectedVersionSchema, publicIdSchema } from '../schemas/common.js';
import { searchCriteriaSchema } from './search.js';

export const bulkSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('ids'),
    items: z
      .array(z.object({ id: publicIdSchema, expectedVersion: expectedVersionSchema }))
      .min(1)
      .max(1000),
  }),
  z.object({ mode: z.literal('query'), criteria: searchCriteriaSchema }),
]);

export const bulkActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tags.add'), tagIds: z.array(publicIdSchema).min(1).max(50) }),
  z.object({ type: z.literal('tags.remove'), tagIds: z.array(publicIdSchema).min(1).max(50) }),
  z.object({ type: z.literal('reading.set'), value: z.enum(['read', 'unread']) }),
  z.object({ type: z.literal('favorite.set'), value: z.boolean() }),
  z.object({ type: z.literal('archive') }),
  z.object({ type: z.literal('restore') }),
  z.object({ type: z.literal('delete_permanently') }),
]);

export const bulkPreviewSchema = z.object({ selection: bulkSelectionSchema, action: bulkActionSchema });
export const bulkExecuteSchema = bulkPreviewSchema.extend({ confirmationToken: z.string().optional() });
export type BulkSelection = z.infer<typeof bulkSelectionSchema>;
export type BulkAction = z.infer<typeof bulkActionSchema>;
