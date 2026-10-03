import { NextResponse } from "next/server";
import { ValidationError } from "./validation";

export class DuplicateError extends Error { constructor(public readonly existingBookmarkId: string) { super("This address is already saved."); } }
export class NotFoundError extends Error { constructor() { super("Bookmark not found."); } }

export function errorResponse(error: unknown) {
  if (error instanceof ValidationError) return NextResponse.json({ error: { code: "validation_error", message: error.message, field: error.field } }, { status: 400 });
  if (error instanceof DuplicateError) return NextResponse.json({ error: { code: "duplicate_url", message: error.message, existingBookmarkId: error.existingBookmarkId } }, { status: 409 });
  if (error instanceof NotFoundError) return NextResponse.json({ error: { code: "not_found", message: error.message } }, { status: 404 });
  console.error("Request failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong. Please try again." } }, { status: 500 });
}
