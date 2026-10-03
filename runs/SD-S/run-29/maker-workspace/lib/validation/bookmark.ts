import { z } from "zod";
import { normalizeBookmarkUrl, normalizeTag, normalizeTitle } from "@/lib/domain/normalization";

export const bookmarkInputSchema = z.object({
  title: z.string().transform(normalizeTitle).pipe(z.string().min(1, "Enter a title.").max(200, "Keep the title to 200 characters or fewer.")),
  url: z.string().transform((value, ctx) => {
    try { return normalizeBookmarkUrl(value); } catch (error) { ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Enter a valid web address." }); return z.NEVER; }
  }),
  tags: z.array(z.string()).max(20, "Use no more than 20 tags.").transform((values, ctx) => {
    const normalized = values.filter((value) => value.trim()).map(normalizeTag);
    const unique = [...new Map(normalized.map((tag) => [tag.normalizedName, tag])).values()];
    for (const tag of unique) if (!tag.name || tag.name.length > 50) ctx.addIssue({ code: "custom", message: "Each tag must be between 1 and 50 characters." });
    return unique;
  })
}).strict();

export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;
