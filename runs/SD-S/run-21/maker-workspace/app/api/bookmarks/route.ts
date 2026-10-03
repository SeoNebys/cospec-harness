import { NextRequest, NextResponse } from "next/server";
import { BookmarkService } from "@/lib/bookmarks/service";
import { querySchema } from "@/lib/validation/bookmark";
import { problem } from "@/lib/http/responses";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(raw);
    return NextResponse.json(new BookmarkService().list(query));
  } catch (e) {
    return problem(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      new BookmarkService().create(await request.json()),
      { status: 201 }
    );
  } catch (e) {
    return problem(e);
  }
}
