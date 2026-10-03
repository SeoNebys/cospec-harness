import { NextResponse } from "next/server";
import { createBookmark, listBookmarks } from "@/lib/bookmarks/service";
import { errorResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/security/origin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const query = Object.fromEntries([...params.entries()].filter(([, value]) => value !== ""));
    return NextResponse.json(await listBookmarks(query));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return NextResponse.json(await createBookmark(await request.json()), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
