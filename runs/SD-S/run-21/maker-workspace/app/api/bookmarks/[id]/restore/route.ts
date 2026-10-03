import { NextRequest, NextResponse } from "next/server";
import { BookmarkService } from "@/lib/bookmarks/service";
import { problem } from "@/lib/http/responses";
export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return NextResponse.json(new BookmarkService().restore((await params).id));
  } catch (e) {
    return problem(e);
  }
}
