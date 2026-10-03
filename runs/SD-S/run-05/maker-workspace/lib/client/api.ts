import type { Bookmark, BookmarkInput, TagSummary } from "@/lib/contracts/bookmark";
import type { MetadataPreview } from "@/lib/contracts/metadata";

async function json<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,init); const data=response.status===204?null:await response.json();
  if(!response.ok)throw Object.assign(new Error(data?.error?.message??"Request failed."),{data,status:response.status}); return data as T;
}
const body=(value:unknown)=>({headers:{"content-type":"application/json"},body:JSON.stringify(value)});
export const api={
  list:(q="",tag="")=>json<{bookmarks:Bookmark[];total:number}>(`/api/bookmarks?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`),
  tags:()=>json<{tags:TagSummary[]}>("/api/tags"),
  preview:(url:string,signal?:AbortSignal)=>json<MetadataPreview>("/api/metadata",{method:"POST",...body({url}),signal}),
  create:(input:BookmarkInput)=>json<Bookmark>("/api/bookmarks",{method:"POST",...body(input)}),
  update:(id:string,input:BookmarkInput)=>json<Bookmark>(`/api/bookmarks/${id}`,{method:"PUT",...body(input)}),
  remove:(id:string)=>json<void>(`/api/bookmarks/${id}`,{method:"DELETE"})
};
