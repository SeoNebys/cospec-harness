import { NextResponse } from "next/server";
import { applyBulkAction } from "@/features/bookmarks/bulk-service";
import { guardApiRequest } from "@/lib/http/guard-request";
import { problem } from "@/lib/http/problem";

type Context = { params: Promise<{ bookmarkId: string }> };

export async function POST(request: Request, { params }: Context) {
  const guarded = await guardApiRequest(request, { csrf: true });
  if ("response" in guarded) return guarded.response;
  try {
    const body = await request.json();
    const result = applyBulkAction(guarded.session.user.id, { ids: [(await params).bookmarkId], operation: "permanent_delete", confirmPermanent: body.confirmPermanent, expectedCount: body.expectedCount });
    return NextResponse.json(result);
  } catch (error) {
    return problem(422, "Permanent deletion not confirmed", error instanceof Error ? error.message : "Confirm this deletion and try again.");
  }
}
