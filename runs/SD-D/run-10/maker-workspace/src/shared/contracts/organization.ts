import { z } from 'zod';
import { expectedVersionSchema, publicIdSchema } from '../schemas/common.js';

export const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => !value.startsWith('#'), {
    message: 'Enter the tag name without a leading #.',
  });
export const collectionNameSchema = z.string().trim().min(1).max(120);
export const tagCreateSchema = z.object({ name: tagNameSchema });
export const tagPatchSchema = z.object({ expectedVersion: expectedVersionSchema, name: tagNameSchema });
export const tagMergeSchema = z.object({
  expectedVersion: expectedVersionSchema,
  targetTagId: publicIdSchema,
  confirmation: z.literal('merge'),
});
export const tagDeleteSchema = z.object({
  expectedVersion: expectedVersionSchema,
  confirmation: z.literal('delete'),
  expectedBookmarkCount: z.number().int().nonnegative(),
  expectedSavedSearchCount: z.number().int().nonnegative(),
});
export const collectionCreateSchema = z.object({ name: collectionNameSchema });
export const collectionPatchSchema = z.object({
  expectedVersion: expectedVersionSchema,
  name: collectionNameSchema,
});
export const collectionDeleteSchema = z.object({
  expectedVersion: expectedVersionSchema,
  confirmation: z.literal('unfile'),
  expectedBookmarkCount: z.number().int().nonnegative(),
});

export type TagSummary = { id: string; name: string; bookmarkCount: number; version: number };
export type CollectionSummary = {
  id: string;
  name: string;
  activeBookmarkCount: number;
  archivedBookmarkCount: number;
  version: number;
};
