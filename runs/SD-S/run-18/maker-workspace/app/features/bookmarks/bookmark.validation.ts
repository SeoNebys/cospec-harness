import { z } from "zod";
import { normalizeBookmarkUrl } from "./url-normalization";

const validUrl = z.string().max(2048).superRefine((value, context) => {
  try { normalizeBookmarkUrl(value); }
  catch (error) { context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Enter a valid web address." }); }
});

export const tagNameSchema = z.string().trim().min(1).max(50);

export const bookmarkInputSchema = z.object({
  url: validUrl,
  title: z.string().trim().min(1, "A title is required.").max(300),
  description: z.string().trim().max(1000).nullable().optional().transform((value) => value || null),
  tags: z.array(tagNameSchema).max(20).default([]),
}).strict();

export const metadataPreviewInputSchema = z.object({
  url: z.string().max(2048),
  requestId: z.string().min(1).max(100),
}).strict();

export const metadataPreviewSchema = z.object({
  requestId: z.string(),
  url: z.url(),
  title: z.string().min(1).max(300),
  description: z.string().max(1000).nullable(),
  status: z.enum(["retrieved", "fallback"]),
  warningCode: z.enum(["unreachable", "blocked", "timeout", "non_html", "missing_title"]).nullable(),
  duplicate: z.object({ id: z.string(), title: z.string() }).nullable(),
});

export const bookmarkListQuerySchema = z.object({
  query: z.string().trim().max(300).default(""),
  tag: z.string().trim().max(50).default(""),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;
