import { NextRequest, NextResponse } from "next/server";

export function requireJsonAndSameOrigin(request: NextRequest): NextResponse | null {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: { code: "unsupported_media_type", message: "Request body must be JSON." } }, { status: 415 });
  }
  const originError=requireSameOrigin(request); if(originError)return originError;
  return null;
}

export function requireSameOrigin(request:NextRequest):NextResponse|null {
  const origin=request.headers.get("origin"); const host=request.headers.get("x-forwarded-host")??request.headers.get("host");
  if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:{code:"validation_error",message:"Cross-origin requests are not allowed."}},{status:403});}catch{return NextResponse.json({error:{code:"validation_error",message:"Invalid request origin."}},{status:403});}}
  return null;
}
