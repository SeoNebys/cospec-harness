import { NextRequest, NextResponse } from "next/server";
import { BookmarkService } from "@/lib/bookmarks/service";
import { problem } from "@/lib/http/responses";
type C = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, c: C) {
  try {
    return NextResponse.json(new BookmarkService().get((await c.params).id));
  } catch (e) {
    return problem(e);
  }
}
export async function PATCH(r: NextRequest, c: C) {
  try {
    return NextResponse.json(
      new BookmarkService().update((await c.params).id, await r.json())
    );
  } catch (e) {
    return problem(e);
  }
}
export async function DELETE(_: NextRequest, c: C) {
  try {
    new BookmarkService().delete((await c.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return problem(e);
  }
}
