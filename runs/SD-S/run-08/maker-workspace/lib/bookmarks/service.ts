import { AppError } from "../errors";
import { bookmarkListQuerySchema, bookmarkWriteSchema } from "./schemas";
import * as repository from "./repository";

function parseOrValidationError<T>(result: { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } }): T {
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new AppError("VALIDATION_ERROR", issue?.message ?? "Invalid input.", 422, issue?.path[0]?.toString());
}

export async function createBookmark(input: unknown) {
  return repository.createBookmark(parseOrValidationError(bookmarkWriteSchema.safeParse(input)));
}
export async function updateBookmark(id: string, input: unknown) {
  return repository.updateBookmark(id, parseOrValidationError(bookmarkWriteSchema.safeParse(input)));
}
export async function getBookmark(id: string) { return repository.getBookmark(id); }
export async function deleteBookmark(id: string) { return repository.deleteBookmark(id); }
export async function listBookmarks(input: unknown) {
  return repository.listBookmarks(parseOrValidationError(bookmarkListQuerySchema.safeParse(input)));
}
