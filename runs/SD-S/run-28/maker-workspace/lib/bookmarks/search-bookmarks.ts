import { z } from "zod";
import { listBookmarks } from "@/lib/bookmarks/repository";

export function parseBookmarkQuery(url:string){const params=new URL(url).searchParams;const favorite=params.get("favorite");return z.object({q:z.string().max(200).optional(),tags:z.array(z.string().max(50)).max(25),favorite:z.boolean().optional(),status:z.enum(["active","archived"]),cursor:z.string().max(500).optional(),limit:z.number().int().min(1).max(100)}).parse({q:params.get("q")||undefined,tags:params.getAll("tags"),favorite:favorite===null?undefined:favorite==="true",status:params.get("status")==="archived"?"archived":"active",cursor:params.get("cursor")||undefined,limit:Number(params.get("limit")||50)});}
export { listBookmarks };
