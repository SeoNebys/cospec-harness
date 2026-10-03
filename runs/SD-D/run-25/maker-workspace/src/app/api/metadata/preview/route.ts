import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { guardApiRequest } from "@/lib/http/guard-request";
import { problem } from "@/lib/http/problem";
import { metadataPreviewRequestSchema } from "@/features/bookmarks/validation";
import { DuplicateBookmarkError, previewBookmark } from "@/features/bookmarks/bookmark-service";
import { UrlValidationError } from "@/features/bookmarks/url-normalizer";
import { getConfig } from "@/lib/config";

const windows = new Map<string, { start: number; count: number }>();

function allowed(userId: string): boolean {
  const now = Date.now();
  const current = windows.get(userId);
  if (!current || now - current.start >= 60_000) { windows.set(userId, { start: now, count: 1 }); return true; }
  if (current.count >= getConfig().METADATA_RATE_PER_MINUTE) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const guarded = await guardApiRequest(request, { csrf: true });
  if ("response" in guarded) return guarded.response;
  if (!allowed(guarded.session.user.id)) return problem(429, "Preview limit reached", "Wait a moment before fetching another page.");
  try {
    const input = metadataPreviewRequestSchema.parse(await request.json());
    const result = await previewBookmark(guarded.session.user.id, input.url);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof DuplicateBookmarkError) return problem(409, "Bookmark already saved", error.message, { existingBookmarkId: error.bookmarkId, existingView: error.view });
    if (error instanceof ZodError || error instanceof UrlValidationError) return problem(422, "Check the web address", error.message);
    return problem(500, "Preview unavailable", "The page details could not be fetched. You can still save the link.");
  }
}
