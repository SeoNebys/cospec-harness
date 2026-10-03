import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { editBookmark, DuplicateBookmarkError } from "@/features/bookmarks/bookmark-service";
import { findBookmark } from "@/lib/db/repositories/bookmark-repository";
import { guardApiRequest } from "@/lib/http/guard-request";
import { notFound, problem } from "@/lib/http/problem";

type Context = { params: Promise<{ bookmarkId: string }> };

export async function GET(request: Request, { params }: Context) {
  const guarded = await guardApiRequest(request);
  if ("response" in guarded) return guarded.response;
  const item = findBookmark(guarded.session.user.id, (await params).bookmarkId);
  return item ? NextResponse.json(item) : notFound();
}

export async function PATCH(request: Request, { params }: Context) {
  const guarded = await guardApiRequest(request, { csrf: true });
  if ("response" in guarded) return guarded.response;
  try {
    const item = await editBookmark(guarded.session.user.id, (await params).bookmarkId, await request.json());
    return item ? NextResponse.json(item) : notFound();
  } catch (error) {
    if (error instanceof DuplicateBookmarkError) return problem(409, "Bookmark already saved", error.message, { existingBookmarkId: error.bookmarkId, existingView: error.view });
    if (error instanceof ZodError) return problem(422, "Check the bookmark details", "Some bookmark fields need attention.", { fieldErrors: error.flatten().fieldErrors });
    return problem(500, "Bookmark not updated", "Nothing was changed. Please try again.");
  }
}
