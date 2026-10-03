import { z } from "zod";
import { createBookmarkRecord, findDuplicate } from "@/lib/bookmarks/repository";
import { fetchPageMetadata } from "@/lib/metadata/fetch-page";
import { normalizeBookmarkUrl } from "@/lib/metadata/url";

export const createBookmarkSchema=z.object({url:z.string().min(1).max(2048),notes:z.string().max(5000).optional(),tags:z.array(z.string().min(1).max(50)).max(25).optional(),allowDuplicate:z.boolean().default(false)});

export async function createBookmark(userId:string,input:z.infer<typeof createBookmarkSchema>){const normalized=normalizeBookmarkUrl(input.url);const duplicate=findDuplicate(userId,normalized.hash);if(duplicate&&!input.allowDuplicate)return{kind:"duplicate" as const,existing:duplicate};const metadata=await fetchPageMetadata(normalized.fetchUrl);const bookmark=createBookmarkRecord({userId,url:normalized.storedUrl,hash:normalized.hash,fallbackTitle:normalized.fallbackTitle,metadata,notes:input.notes,tags:input.tags});return{kind:"created" as const,bookmark,outcome:metadata.status==="complete"?"metadata_complete":metadata.status==="partial"?"metadata_partial":"metadata_unavailable"};}
