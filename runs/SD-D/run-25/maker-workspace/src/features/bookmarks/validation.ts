import { z } from "zod";
import { metadataStatuses, readingStates } from "@/lib/db/schema";

export const tagNameSchema = z.string().trim().min(1, "Enter a tag name.").max(64, "Tags can be at most 64 characters.");
export const tagsSchema = z.array(tagNameSchema).max(50, "A bookmark can have at most 50 tags.");
export const metadataStatusSchema = z.enum(metadataStatuses);

export const bookmarkWriteSchema = z.object({
  url: z.string().trim().min(1, "Enter a web address.").max(4096, "Web addresses can be at most 4,096 characters."),
  title: z.string().trim().min(1, "A title is required.").max(500, "Titles can be at most 500 characters."),
  pageDescription: z.string().trim().max(2000, "Descriptions can be at most 2,000 characters.").nullable().optional(),
  iconPreviewKey: z.string().max(128).nullable().optional(),
  metadataStatus: metadataStatusSchema.default("not_requested"),
  noteMarkdown: z.string().max(50000, "Notes can be at most 50,000 characters.").nullable().optional(),
  tags: tagsSchema.default([]),
  readingState: z.enum(readingStates).default("none"),
});

export const metadataPreviewRequestSchema = z.object({
  url: z.string().trim().min(1).max(4096),
});

export function normalizeTagName(value: string): { displayName: string; normalizedName: string } {
  const displayName = tagNameSchema.parse(value).normalize("NFC").replaceAll(/\s+/g, " ");
  return { displayName, normalizedName: displayName.toLocaleLowerCase("und") };
}
