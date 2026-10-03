import { useEffect, useMemo, useState } from "react";

export type LibraryQuery = { q: string; folderId: string; tagId: string; favorite: boolean; sort: "newest"|"oldest"|"title" };

export function useLibraryQuery() {
  const initial = new URLSearchParams(location.search);
  const [query,setQueryState]=useState<LibraryQuery>({
    q:initial.get("q")??"",folderId:initial.get("folderId")??"",tagId:initial.get("tagId")??"",
    favorite:initial.get("favorite")==="true",sort:(initial.get("sort") as LibraryQuery["sort"])||"newest"
  });
  const [debouncedQ,setDebouncedQ]=useState(query.q);
  useEffect(()=>{const timer=setTimeout(()=>setDebouncedQ(query.q),250);return()=>clearTimeout(timer);},[query.q]);
  useEffect(()=>{
    const params=new URLSearchParams(); if(query.q)params.set("q",query.q);if(query.folderId)params.set("folderId",query.folderId);if(query.tagId)params.set("tagId",query.tagId);if(query.favorite)params.set("favorite","true");if(query.sort!=="newest")params.set("sort",query.sort);
    history.replaceState({},"",`${location.pathname}${params.size?`?${params}`:""}`);
  },[query]);
  const serverParams=useMemo(()=>{const params=new URLSearchParams();if(debouncedQ)params.set("q",debouncedQ);if(query.folderId)params.set("folderId",query.folderId);if(query.tagId)params.set("tagId",query.tagId);if(query.favorite)params.set("favorite","true");params.set("sort",query.sort);return params;},[debouncedQ,query.folderId,query.tagId,query.favorite,query.sort]);
  const setQuery=(patch:Partial<LibraryQuery>)=>setQueryState((current)=>({...current,...patch}));
  const clear=()=>setQueryState({q:"",folderId:"",tagId:"",favorite:false,sort:"newest"});
  return {query,setQuery,clear,serverParams};
}
