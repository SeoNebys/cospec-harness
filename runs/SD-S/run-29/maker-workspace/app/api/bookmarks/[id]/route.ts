import { getCurrentUser } from "@/lib/auth/server";
import { deleteBookmark, listBookmarks, updateBookmark } from "@/lib/dal/bookmarks";
import { privateJson, problem } from "@/lib/http/problem";
import { bookmarkInputSchema } from "@/lib/validation/bookmark";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser(); if (!user) return problem(401, "UNAUTHENTICATED", "Sign in to continue.");
  const { id } = await context.params; const item = (await listBookmarks(user.id)).items.find((bookmark) => bookmark.id === id);
  return item ? privateJson(item) : problem(404, "NOT_FOUND", "Bookmark not found.");
}
export async function PUT(request: Request, context: Context) {
  const user = await getCurrentUser(); if (!user) return problem(401, "UNAUTHENTICATED", "Sign in to continue.");
  const parsed = bookmarkInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "VALIDATION_FAILED", "Check the highlighted fields.", { fieldErrors: z.flattenError(parsed.error).fieldErrors });
  try { const item = await updateBookmark(user.id, (await context.params).id, parsed.data); return item ? privateJson(item) : problem(404, "NOT_FOUND", "Bookmark not found."); }
  catch (error) { if (String(error).includes("unique")) return problem(409, "DUPLICATE_BOOKMARK", "That web address is already in your collection."); return problem(500, "UPDATE_FAILED", "Changes could not be saved. Please try again.", { correlationId: crypto.randomUUID() }); }
}
export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser(); if (!user) return problem(401, "UNAUTHENTICATED", "Sign in to continue.");
  return await deleteBookmark(user.id, (await context.params).id) ? new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } }) : problem(404, "NOT_FOUND", "Bookmark not found.");
}
