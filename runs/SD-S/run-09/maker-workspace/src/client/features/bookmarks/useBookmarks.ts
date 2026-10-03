import { useCallback, useEffect, useState } from "react";
import type { Bookmark, BookmarkPage } from "../../../shared/contracts/bookmarks.js";
import { bookmarkApi } from "./bookmark-api.js";

export function useBookmarks(params: URLSearchParams) {
  const [page,setPage]=useState<BookmarkPage>(); const [error,setError]=useState(""); const [loading,setLoading]=useState(true);
  const key=params.toString();
  const load=useCallback(async()=>{setLoading(true);setError("");try{setPage(await bookmarkApi.list(key));}catch{setError("We couldn’t load your library.");}finally{setLoading(false);}},[key]);
  useEffect(()=>{void load();},[load]);
  const replace=(bookmark:Bookmark)=>setPage((current)=>current?{...current,items:current.items.map((item)=>item.id===bookmark.id?bookmark:item)}:current);
  const remove=(id:number)=>setPage((current)=>current?{...current,items:current.items.filter((item)=>item.id!==id),total:Math.max(0,current.total-1)}:current);
  const prepend=(bookmark:Bookmark)=>setPage((current)=>current?{...current,items:[bookmark,...current.items],total:current.total+1}:current);
  const loadMore=async()=>{if(!page?.nextCursor)return;const next=new URLSearchParams(params);next.set("cursor",page.nextCursor);const extra=await bookmarkApi.list(next.toString());setPage({...extra,items:[...page.items,...extra.items],total:page.total});};
  return {page,error,loading,reload:load,replace,remove,prepend,loadMore};
}
