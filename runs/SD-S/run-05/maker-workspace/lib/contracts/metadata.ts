import { z } from "zod";

export const metadataReasonSchema = z.enum(["invalid_url", "blocked_destination", "timeout", "unsupported_content", "unavailable", "metadata_missing"]);
export const metadataPreviewSchema = z.object({
  status: z.enum(["complete", "partial", "unavailable"]),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(300).optional(),
  finalUrl: z.string().url().max(4096).optional(),
  reason: metadataReasonSchema.optional()
}).strict();
export type MetadataPreview = z.infer<typeof metadataPreviewSchema>;
