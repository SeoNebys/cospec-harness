import { getCurrentUser } from "@/lib/auth/server";
import { createBookmark, findBookmarkByNormalizedUrl, listBookmarks } from "@/lib/dal/bookmarks";
import { privateJson, problem } from "@/lib/http/problem";
import { bookmarkInputSchema } from "@/lib/validation/bookmark";
import { z } from "zod";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return problem(401, "UNAUTHENTICATED", "Sign in to view bookmarks.");
  const params = new URL(request.url).searchParams;
  const limit = Math.max(1, Math.min(50, Number(params.get("limit")) || 50));
  return privateJson(await listBookmarks(user.id, params.get("q") ?? "", params.get("tagId") ?? "", limit));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return problem(401, "UNAUTHENTICATED", "Sign in to save bookmarks.");
  const parsed = bookmarkInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "VALIDATION_FAILED", "Check the highlighted fields.", { fieldErrors: z.flattenError(parsed.error).fieldErrors });
  const existing = await findBookmarkByNormalizedUrl(user.id, parsed.data.url.normalizedUrl);
  if (existing) return problem(409, "DUPLICATE_BOOKMARK", "Already saved — taking you to it.", { existingBookmarkId: existing.id });
  try { return privateJson(await createBookmark(user.id, parsed.data), { status: 201 }); }
  catch (error) {
    const racedDuplicate = await findBookmarkByNormalizedUrl(user.id, parsed.data.url.normalizedUrl);
    if (racedDuplicate) return problem(409, "DUPLICATE_BOOKMARK", "Already saved — taking you to it.", { existingBookmarkId: racedDuplicate.id });
    console.error("bookmark_create_failed", { error: error instanceof Error ? error.message : "unknown" });
    return problem(500, "SAVE_FAILED", "The bookmark could not be saved. Please try again.", { correlationId: crypto.randomUUID() });
  }
}
