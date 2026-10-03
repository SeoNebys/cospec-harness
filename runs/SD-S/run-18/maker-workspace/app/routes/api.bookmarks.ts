import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireResourceUser } from "~/auth/require-user.server";
import { db } from "~/db/client.server";
import { bookmarkInputSchema, bookmarkListQuerySchema } from "~/features/bookmarks/bookmark.validation";
import { BookmarkServiceError, createBookmarkService } from "~/features/bookmarks/bookmark.service.server";
import { problem, validationProblem } from "~/lib/http-problem.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireResourceUser(request);
  const url = new URL(request.url);
  const query = bookmarkListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return validationProblem(query.error);
  try {
    return Response.json(createBookmarkService(db).list(user.id, query.data));
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return problem(422, "VALIDATION_ERROR", "The cursor is invalid.");
    }
    throw error;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireResourceUser(request);
  const parsed = bookmarkInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    return Response.json(createBookmarkService(db).create(user.id, parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof BookmarkServiceError && error.code === "DUPLICATE_BOOKMARK") {
      return problem(409, error.code, "This page is already in your library.", { existingBookmark: error.existing });
    }
    throw error;
  }
}
