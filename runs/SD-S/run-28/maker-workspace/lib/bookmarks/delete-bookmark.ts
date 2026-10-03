import { deleteBookmarkRecord } from "@/lib/bookmarks/repository";
export function deleteBookmark(userId:string,id:string,version:number){return deleteBookmarkRecord(userId,id,version);}
