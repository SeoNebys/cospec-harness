import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { guardApiRequest } from "@/lib/http/guard-request";
import { problem } from "@/lib/http/problem";
import { DuplicateBookmarkError, saveBookmark } from "@/features/bookmarks/bookmark-service";
import { listBookmarks } from "@/lib/db/repositories/bookmark-repository";
import { SearchQueryError } from "@/features/bookmarks/search-parser";
import type { CollectionView, SortOrder } from "@/features/bookmarks/types";
import type { ReadingState } from "@/lib/db/schema";

export async function GET(request: Request) {
  const guarded = await guardApiRequest(request);
  if ("response" in guarded) return guarded.response;
  const url = new URL(request.url);
  try {
    const items = listBookmarks(guarded.session.user.id, {
      view: (url.searchParams.get("view") ?? "active") as CollectionView,
      q: url.searchParams.get("q") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      readingState: (url.searchParams.get("readingState") as ReadingState | null) ?? undefined,
      sort: (url.searchParams.get("sort") ?? "newest") as SortOrder,
      limit: Number(url.searchParams.get("limit") ?? 100),
    });
    return NextResponse.json({ items, nextCursor: null, hasMore: false, totalVisible: items.length }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SearchQueryError) return problem(422, "Search query is incomplete", error.message, { queryOffset: error.offset, queryHint: error.hint });
    return problem(422, "Invalid collection request", "Check the filters and try again.");
  }
}

export async function POST(request: Request) {
  const guarded = await guardApiRequest(request, { csrf: true });
  if ("response" in guarded) return guarded.response;
  try {
    const item = saveBookmark(guarded.session.user.id, await request.json());
    return NextResponse.json(item, { status: 201, headers: { location: `/bookmarks/${item.id}` } });
  } catch (error) {
    if (error instanceof DuplicateBookmarkError) return problem(409, "Bookmark already saved", error.message, { existingBookmarkId: error.bookmarkId, existingView: error.view });
    if (error instanceof ZodError) return problem(422, "Check the bookmark details", "Some bookmark fields need attention.", { fieldErrors: error.flatten().fieldErrors });
    return problem(500, "Bookmark not saved", "Nothing was changed. Please try again.");
  }
}
