import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { createBookmark, createBookmarkSchema } from "@/lib/bookmarks/create-bookmark";
import { listBookmarks, parseBookmarkQuery } from "@/lib/bookmarks/search-bookmarks";
import { apiError, validationError } from "@/lib/http/errors";
import { readJson } from "@/lib/http/request";
import { hasTrustedOrigin } from "@/lib/security/origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { UrlValidationError } from "@/lib/metadata/url";

export async function GET(request:Request){const session=await requireApiSession(request);if(!session)return apiError(request,401,"UNAUTHORIZED","Sign in to continue.");try{const query=parseBookmarkQuery(request.url);const result=listBookmarks(session.user.id,query);return NextResponse.json({...result,appliedFilters:{q:query.q??null,tags:query.tags,favorite:query.favorite??null,status:query.status}});}catch{return apiError(request,400,"BAD_QUERY","The search or filter request is invalid.");}}

export async function POST(request:Request){const session=await requireApiSession(request);if(!session)return apiError(request,401,"UNAUTHORIZED","Sign in to continue.");if(!hasTrustedOrigin(request))return apiError(request,403,"ORIGIN_REJECTED","This request did not come from the trusted application.");const rate=checkRateLimit(`metadata:${session.user.id}`,20,60_000);if(!rate.allowed)return NextResponse.json({code:"RATE_LIMITED",message:"Please wait before saving another link.",requestId:crypto.randomUUID()},{status:429,headers:{"Retry-After":String(rate.retryAfter)}});try{const input=createBookmarkSchema.parse(await readJson(request));const result=await createBookmark(session.user.id,input);if(result.kind==="duplicate")return NextResponse.json({code:"DUPLICATE_BOOKMARK",message:"You already saved this address.",existing:result.existing},{status:409});return NextResponse.json({bookmark:result.bookmark,outcome:result.outcome},{status:201});}catch(error){if(error instanceof ZodError)return validationError(request,error);if(error instanceof UrlValidationError)return apiError(request,422,"URL_INVALID",error.message);if(error instanceof Error&&error.message==="PAYLOAD_TOO_LARGE")return apiError(request,413,"PAYLOAD_TOO_LARGE","The request is too large.");return apiError(request,500,"SAVE_FAILED","The bookmark was not saved. Your details are still available to retry.");}}
