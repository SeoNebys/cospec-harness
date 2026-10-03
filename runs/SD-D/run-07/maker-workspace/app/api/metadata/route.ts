import { NextResponse } from "next/server";
import { previewMetadata } from "@/lib/metadata/service";

const statusFor:Record<string,number>={INVALID_URL:400,UNSUPPORTED_SCHEME:400,UNSUPPORTED_PORT:400,BLOCKED_DESTINATION:403,REDIRECT_LIMIT:502,DOWNGRADE_REDIRECT:403,TIMEOUT:408,CONTENT_TOO_LARGE:413,UNSUPPORTED_CONTENT:415,UPSTREAM_ERROR:502};
export async function POST(request:Request) {
  try { const body=await request.json(); if(typeof body.url!=="string"||body.url.length>4096) throw Object.assign(new Error("Enter a valid web address."),{code:"INVALID_URL"}); return NextResponse.json(await previewMetadata(body.url)); }
  catch(error) { const e=error as Error&{code?:string}; const code=e.code||"UPSTREAM_ERROR"; return NextResponse.json({code,message:e.message||"We could not preview this page.",canContinueManually:true},{status:statusFor[code]||502}); }
}
