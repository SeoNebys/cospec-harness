"use client";
import type { Bookmark } from "@/lib/contracts/bookmark";
import { BookmarkCard } from "./bookmark-card";
export function BookmarkList({bookmarks,loading,filtered,onEdit,onDelete,onTag,onClear}:{bookmarks:Bookmark[];loading:boolean;filtered:boolean;onEdit:(b:Bookmark)=>void;onDelete:(b:Bookmark)=>void;onTag:(t:string)=>void;onClear:()=>void}){
 if(loading)return <div className="empty"><div className="empty-icon">···</div><h2>Finding your bookmarks…</h2></div>;
 if(!bookmarks.length)return <div className="empty"><div className="empty-icon">⌁</div><h2>{filtered?"Nothing matches yet":"Your shelf is ready"}</h2><p>{filtered?"Try a different word or clear the current filter.":"Paste your first link above. We’ll fill in the page details for you."}</p>{filtered&&<button className="quiet" onClick={onClear}>Clear search and filters</button>}</div>;
 return <div className="bookmark-grid">{bookmarks.map(b=><BookmarkCard key={b.id} bookmark={b} onEdit={()=>onEdit(b)} onDelete={()=>onDelete(b)} onTag={onTag}/>)}</div>;
}
