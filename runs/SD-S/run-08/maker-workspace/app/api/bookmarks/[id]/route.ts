import { NextResponse } from "next/server";
import { deleteBookmark, getBookmark, updateBookmark } from "@/lib/bookmarks/service";
import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/security/origin";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const item = await getBookmark((await context.params).id);
    if (!item) throw new AppError("NOT_FOUND", "Bookmark not found.", 404);
    return NextResponse.json(item);
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    return NextResponse.json(await updateBookmark((await context.params).id, await request.json()));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    await deleteBookmark((await context.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
