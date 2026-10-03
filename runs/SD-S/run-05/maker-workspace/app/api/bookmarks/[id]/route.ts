import { NextRequest, NextResponse } from "next/server";
import { bookmarkInputSchema } from "@/lib/contracts/bookmark";
import { deleteBookmark, updateBookmark } from "@/lib/server/bookmarks";
import { errorResponse } from "@/lib/server/http-errors";
import { requireJsonAndSameOrigin, requireSameOrigin } from "@/lib/server/same-origin";

export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const rejected=requireJsonAndSameOrigin(request); if(rejected)return rejected;
  try { const parsed=bookmarkInputSchema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:{code:"validation_error",message:"Check the highlighted bookmark details."}},{status:400}); return NextResponse.json(updateBookmark((await params).id,parsed.data)); }
  catch(error){return errorResponse(error);}
}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const rejected=requireSameOrigin(request); if(rejected)return rejected;
  try { deleteBookmark((await params).id); return new NextResponse(null,{status:204}); } catch(error){return errorResponse(error);}
}
