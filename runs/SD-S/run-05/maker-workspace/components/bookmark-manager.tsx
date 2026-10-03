"use client";
import { useCallback,useEffect,useState } from "react";
import type { Bookmark,TagSummary } from "@/lib/contracts/bookmark";
import { api } from "@/lib/client/api";
import { BookmarkForm } from "./bookmark-form";
import { BookmarkList } from "./bookmark-list";
import { DeleteDialog } from "./delete-dialog";
import { SearchControls } from "./search-controls";
import { StatusMessage } from "./status-message";

export function BookmarkManager(){
 const [bookmarks,setBookmarks]=useState<Bookmark[]>([]),[tags,setTags]=useState<TagSummary[]>([]),[query,setQuery]=useState(""),[tag,setTag]=useState(""),[loading,setLoading]=useState(true),[ready,setReady]=useState(false),[editing,setEditing]=useState<Bookmark|null>(null),[deleting,setDeleting]=useState<Bookmark|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const refresh=useCallback(async(q=query,t=tag)=>{setLoading(true);try{const [b,ts]=await Promise.all([api.list(q,t),api.tags()]);setBookmarks(b.bookmarks);setTags(ts.tags);setError("");}catch(e){setError((e as Error).message);}finally{setLoading(false);setReady(true);}},[query,tag]);
 useEffect(()=>{const id=setTimeout(()=>refresh(query,tag),250);return()=>clearTimeout(id);},[query,tag,refresh]);
 async function remove(){if(!deleting)return;setBusy(true);try{await api.remove(deleting.id);setDeleting(null);await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main data-harness-ready={ready?"true":undefined}><header className="site-header"><a className="brand" href="#top"><span className="brand-mark">K</span><span>kept.</span></a><div className="header-note">A quiet place for good links.</div></header><div className="hero" id="top"><div><div className="eyebrow">Your corner of the internet</div><h1>Save what matters.<br/><em>Find it when it does.</em></h1><p>Drop in a link. We’ll bring the details. You add the meaning.</p></div><div className="shelf-art" aria-hidden="true"><span>⌁</span><span>↗</span><span>✦</span></div></div><BookmarkForm key={editing?.id??"new"} editing={editing} onCancel={()=>setEditing(null)} onSaved={()=>{setEditing(null);refresh();}}/><section className="collection" aria-labelledby="collection-heading"><div className="collection-title"><div><div className="section-kicker">Your collection</div><h2 id="collection-heading">Bookmarks <span>{bookmarks.length}</span></h2></div></div><SearchControls query={query} tag={tag} tags={tags} onQuery={setQuery} onTag={setTag}/><StatusMessage tone="error">{error}</StatusMessage><BookmarkList bookmarks={bookmarks} loading={loading} filtered={Boolean(query||tag)} onEdit={b=>{setEditing(b);window.scrollTo({top:300,behavior:"smooth"});}} onDelete={setDeleting} onTag={setTag} onClear={()=>{setQuery("");setTag("");}}/></section><footer><span>kept.</span><span>Good links deserve a good home.</span></footer><DeleteDialog bookmark={deleting} onCancel={()=>setDeleting(null)} onConfirm={remove} busy={busy}/></main>;
}
