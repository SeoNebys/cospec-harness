import { z } from "zod";

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const bookmarkFields = z.object({
  url: z
    .url()
    .refine((v) => /^https?:/i.test(v), "Use an HTTP or HTTPS address"),
  title: z.string().trim().min(1).max(300),
  description: nullableText(1000),
  notes: nullableText(10000),
  siteIconUrl: z.url().nullable().optional(),
  previewImageUrl: z.url().nullable().optional(),
  favorite: z.boolean(),
  readingStatus: z.enum(["to_read", "read"]),
  tags: z.array(z.string().trim().min(1).max(50)).max(30),
  allowDuplicate: z.boolean()
});
export const bookmarkInputSchema = bookmarkFields.extend({
  favorite: z.boolean().optional().default(false),
  readingStatus: z.enum(["to_read", "read"]).optional().default("to_read"),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(30)
    .optional()
    .default([]),
  allowDuplicate: z.boolean().optional().default(false)
});
export const bookmarkPatchSchema = bookmarkFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one change");
export const querySchema = z.object({
  scope: z
    .enum(["active", "to_read", "favorites", "archived"])
    .default("active"),
  q: z.string().trim().max(300).optional(),
  tag: z.string().optional(),
  favorite: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  readingStatus: z.enum(["to_read", "read"]).optional(),
  sort: z
    .enum(["created_desc", "title_asc", "updated_desc"])
    .default("created_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24)
});
