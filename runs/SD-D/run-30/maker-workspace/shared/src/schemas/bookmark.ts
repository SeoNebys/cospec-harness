import { z } from 'zod';
import { tagsSchema, titleSchema, urlSchema } from './common.js';

export const bookmarkInputSchema = z.object({
  url: urlSchema, title: titleSchema, noteSource: z.string().max(2000).default(''), tags: tagsSchema.default([]),
  metadataPreview: z.object({ iconCandidate: z.string().url().nullable().optional(), previewCandidate: z.string().url().nullable().optional() }).optional(),
});
// PATCH fields are declared independently: deriving this from bookmarkInputSchema
// would retain create-time defaults and turn omitted notes/tags into destructive
// empty values during state-only changes.
export const bookmarkPatchSchema = z.object({
  url: urlSchema.optional(),
  title: titleSchema.optional(),
  noteSource: z.string().max(2000).optional(),
  tags: tagsSchema.optional(),
  metadataPreview: z.object({ iconCandidate: z.string().url().nullable().optional(), previewCandidate: z.string().url().nullable().optional() }).optional(),
  isFavorite: z.boolean().optional(),
  isReadLater: z.boolean().optional(),
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one change is required');
