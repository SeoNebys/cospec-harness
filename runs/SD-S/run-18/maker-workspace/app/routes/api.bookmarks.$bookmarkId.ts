import type { ActionFunctionArgs } from "react-router";
import { requireResourceUser } from "~/auth/require-user.server";
import { db } from "~/db/client.server";
import { BookmarkServiceError, createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { bookmarkInputSchema } from "~/features/bookmarks/bookmark.validation";
import { problem, validationProblem } from "~/lib/http-problem.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireResourceUser(request);
  const bookmarkId = params.bookmarkId;
  if (!bookmarkId) return problem(404, "BOOKMARK_NOT_FOUND", "Bookmark not found.");
  const service = createBookmarkService(db);
  try {
    if (request.method === "DELETE") {
      service.delete(user.id, bookmarkId);
      return new Response(null, { status: 204 });
    }
    if (request.method === "PATCH") {
      const parsed = bookmarkInputSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return validationProblem(parsed.error);
      return Response.json(service.update(user.id, bookmarkId, parsed.data));
    }
    return new Response(null, { status: 405, headers: { allow: "PATCH, DELETE" } });
  } catch (error) {
    if (error instanceof BookmarkServiceError && error.code === "BOOKMARK_NOT_FOUND") {
      return problem(404, error.code, "Bookmark not found.");
    }
    if (error instanceof BookmarkServiceError && error.code === "DUPLICATE_BOOKMARK") {
      return problem(409, error.code, "This page is already in your library.", { existingBookmark: error.existing });
    }
    throw error;
  }
}
