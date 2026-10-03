import { NextResponse } from "next/server";
import { BookmarkService } from "@/lib/bookmarks/service";
import { problem } from "@/lib/http/responses";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(new BookmarkService().tags());
  } catch (e) {
    return problem(e);
  }
}
