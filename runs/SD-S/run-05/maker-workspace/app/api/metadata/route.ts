import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { previewMetadata } from "@/lib/server/metadata-preview";
import { requireJsonAndSameOrigin } from "@/lib/server/same-origin";

export const runtime="nodejs"; export const dynamic="force-dynamic";
const input=z.object({url:z.string().trim().min(1).max(4096)}).strict();
export async function POST(request:NextRequest){
  const rejected=requireJsonAndSameOrigin(request); if(rejected)return rejected;
  const parsed=input.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:{code:"validation_error",message:"Enter a valid web address.",field:"url"}},{status:400});
  const result=await previewMetadata(parsed.data.url,request.headers.get("x-forwarded-for")??"local");
  if(!result)return NextResponse.json({error:{code:"rate_limited",message:"Too many preview requests. Wait a moment and try again."}},{status:429});
  return NextResponse.json(result);
}
