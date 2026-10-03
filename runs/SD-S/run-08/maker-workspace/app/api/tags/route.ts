import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { listTags } from "@/lib/tags/repository";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json({ items: await listTags() }); }
  catch (error) { return errorResponse(error); }
}
