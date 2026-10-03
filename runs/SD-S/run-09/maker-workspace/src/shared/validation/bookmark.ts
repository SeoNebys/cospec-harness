import { z } from "zod";
import { codePointLength, optionalTrimmedNotes, positiveId } from "./common.js";

export function cleanTitle(value: string): string {
  return Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || (code >= 127 && code <= 159) ? " " : character;
  }).join("").replace(/\s+/gu, " ").trim();
}

export const titleSchema = z.string().transform(cleanTitle).refine(
  (value) => codePointLength(value) >= 1 && codePointLength(value) <= 300,
  "Title must be between 1 and 300 characters"
);

export const bookmarkUrlSchema = z.string().trim().min(1).max(4096).superRefine((value, context) => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      context.addIssue({ code: "custom", message: "Use an http:// or https:// address" });
    }
    if (url.username || url.password) {
      context.addIssue({ code: "custom", message: "Addresses containing credentials are not supported" });
    }
  } catch {
    context.addIssue({ code: "custom", message: "Enter a complete web address" });
  }
});

export const createBookmarkSchema = z.object({
  url: bookmarkUrlSchema,
  title: titleSchema.optional(),
  notes: optionalTrimmedNotes,
  folderId: positiveId.nullable().optional(),
  tagIds: z.array(positiveId).max(50).default([]),
  isFavorite: z.boolean().default(false),
  metadataReceipt: z.string().max(16_384).optional(),
  duplicateAction: z.literal("save_anyway").optional()
});

export const updateBookmarkSchema = z
  .object({
    url: bookmarkUrlSchema.optional(),
    title: titleSchema.optional(),
    notes: optionalTrimmedNotes,
    folderId: positiveId.nullable().optional(),
    tagIds: z.array(positiveId).max(50).optional(),
    duplicateAction: z.literal("save_anyway").optional()
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
