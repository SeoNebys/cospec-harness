"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bulk,deleteBookmark,saveBookmark,setArchived,setStatus } from "@/lib/bookmarks/service";

const tags=(value:FormDataEntryValue|null)=>String(value||"").split(",").map(v=>v.trim()).filter(Boolean);
export async function saveAction(data:FormData){const id=String(data.get("id")||"")||undefined;const result=saveBookmark({url:String(data.get("url")||""),title:String(data.get("title")||""),description:String(data.get("description")||""),note:String(data.get("note")||""),tags:tags(data.get("tags")),isRead:data.get("isRead")!=="unread",isFavorite:data.get("isFavorite")==="on",iconUrl:String(data.get("iconUrl")||"")||null},id);revalidatePath("/");redirect(`/bookmarks/${result.duplicate?.id||result.bookmark?.id}`);}
export async function favoriteAction(id:string,value:boolean){setStatus(id,"is_favorite",value);revalidatePath("/","layout");}
export async function readAction(id:string,value:boolean){setStatus(id,"is_read",value);revalidatePath("/","layout");}
export async function archiveAction(id:string,value:boolean){setArchived(id,value);revalidatePath("/","layout");}
export async function deleteAction(id:string){deleteBookmark(id);revalidatePath("/","layout");redirect("/");}
export async function bulkAction(ids:string[],action:string,tagNames:string[]=[]){const result=bulk(ids,action,tagNames);revalidatePath("/","layout");return result;}
