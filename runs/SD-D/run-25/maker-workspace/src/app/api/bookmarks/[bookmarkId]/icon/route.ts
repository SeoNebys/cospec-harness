import { NextResponse } from "next/server";
import { readIcon } from "@/features/bookmarks/icon-service";
import { findBookmark } from "@/lib/db/repositories/bookmark-repository";
import { guardApiRequest } from "@/lib/http/guard-request";
import { notFound } from "@/lib/http/problem";

type Context = { params: Promise<{ bookmarkId: string }> };

export async function GET(request: Request, { params }: Context) {
  const guarded = await guardApiRequest(request);
  if ("response" in guarded) return guarded.response;
  const item = findBookmark(guarded.session.user.id, (await params).bookmarkId);
  if (!item) return notFound();
  const body = await readIcon(item.iconKey, item.domain.charAt(0));
  return new NextResponse(new Uint8Array(body), { headers: { "content-type": "image/png", "x-content-type-options": "nosniff", "cache-control": "private, max-age=86400" } });
}
