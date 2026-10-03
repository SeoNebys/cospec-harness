import { NextResponse } from "next/server";
import { ZodError,z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { deleteBookmark } from "@/lib/bookmarks/delete-bookmark";
import { getBookmark } from "@/lib/bookmarks/repository";
import { updateBookmark,updateBookmarkSchema } from "@/lib/bookmarks/update-bookmark";
import { apiError,validationError } from "@/lib/http/errors";
import { readJson } from "@/lib/http/request";
import { hasTrustedOrigin } from "@/lib/security/origin";

type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){const session=await requireApiSession(request);if(!session)return apiError(request,401,"UNAUTHORIZED","Sign in to continue.");const item=getBookmark(session.user.id,(await params).id);return item?NextResponse.json(item):apiError(request,404,"NOT_FOUND","Bookmark not found.");}
export async function PATCH(request:Request,{params}:Context){const session=await requireApiSession(request);if(!session)return apiError(request,401,"UNAUTHORIZED","Sign in to continue.");if(!hasTrustedOrigin(request))return apiError(request,403,"ORIGIN_REJECTED","This request did not come from the trusted application.");try{const input=updateBookmarkSchema.parse(await readJson(request));const result=updateBookmark(session.user.id,(await params).id,input);if(!result)return apiError(request,404,"NOT_FOUND","Bookmark not found.");if(result==="conflict")return NextResponse.json({code:"VERSION_CONFLICT",message:"This bookmark changed in another view. Reload it before saving.",requestId:crypto.randomUUID(),current:getBookmark(session.user.id,(await params).id)},{status:409});return NextResponse.json(result);}catch(error){if(error instanceof ZodError)return validationError(request,error);return apiError(request,422,"UPDATE_INVALID","The bookmark changes are invalid.");}}
export async function DELETE(request:Request,{params}:Context){const session=await requireApiSession(request);if(!session)return apiError(request,401,"UNAUTHORIZED","Sign in to continue.");if(!hasTrustedOrigin(request))return apiError(request,403,"ORIGIN_REJECTED","This request did not come from the trusted application.");try{const {version}=z.object({version:z.number().int().min(1)}).parse(await readJson(request));const result=deleteBookmark(session.user.id,(await params).id,version);if(result==="missing")return apiError(request,404,"NOT_FOUND","Bookmark not found.");if(result==="conflict")return apiError(request,409,"VERSION_CONFLICT","This bookmark changed in another view. Reload it before deleting.");return new NextResponse(null,{status:204});}catch(error){if(error instanceof ZodError)return validationError(request,error);return apiError(request,400,"BAD_REQUEST","The delete request is invalid.");}}
