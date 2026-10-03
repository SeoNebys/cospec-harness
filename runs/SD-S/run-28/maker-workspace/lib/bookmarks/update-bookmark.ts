import { z } from "zod";
import { updateBookmarkRecord } from "@/lib/bookmarks/repository";
export const updateBookmarkSchema=z.object({version:z.number().int().min(1),title:z.string().min(1).max(300).optional(),url:z.string().min(1).max(2048).optional(),notes:z.string().max(5000).nullable().optional(),tags:z.array(z.string().min(1).max(50)).max(25).optional(),isFavorite:z.boolean().optional(),status:z.enum(["active","archived"]).optional()}).refine((v)=>Object.keys(v).length>1,"Include a change");
export function updateBookmark(userId:string,id:string,input:z.infer<typeof updateBookmarkSchema>){return updateBookmarkRecord(userId,id,input);}
