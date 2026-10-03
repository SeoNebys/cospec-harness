import { NextRequest, NextResponse } from "next/server";
import { bookmarkInputSchema } from "@/lib/contracts/bookmark";
import { createBookmark, listBookmarks } from "@/lib/server/bookmarks";
import { errorResponse } from "@/lib/server/http-errors";
import { requireJsonAndSameOrigin } from "@/lib/server/same-origin";

export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  try { const q=request.nextUrl.searchParams.get("q")??"", tag=request.nextUrl.searchParams.get("tag")??""; if(q.length>300||tag.length>40) throw new Error("Invalid query"); const bookmarks=listBookmarks(q,tag); return NextResponse.json({bookmarks,total:bookmarks.length}); }
  catch(error){ return errorResponse(error); }
}
export async function POST(request:NextRequest) {
  const rejected=requireJsonAndSameOrigin(request); if(rejected)return rejected;
  try { const parsed=bookmarkInputSchema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:{code:"validation_error",message:"Check the highlighted bookmark details."}},{status:400}); return NextResponse.json(createBookmark(parsed.data),{status:201}); }
  catch(error){return errorResponse(error);}
}
