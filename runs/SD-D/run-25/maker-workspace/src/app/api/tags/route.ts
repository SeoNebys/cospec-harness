import { NextResponse } from "next/server";
import { getSqlite } from "@/lib/db/client";
import { listTags } from "@/lib/db/repositories/tag-repository";
import { guardApiRequest } from "@/lib/http/guard-request";

export async function GET(request: Request) {
  const guarded = await guardApiRequest(request);
  if ("response" in guarded) return guarded.response;
  return NextResponse.json({ items: listTags(getSqlite(), guarded.session.user.id) });
}
