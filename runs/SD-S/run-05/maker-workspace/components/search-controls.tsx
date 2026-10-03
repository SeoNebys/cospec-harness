"use client";
import type { TagSummary } from "@/lib/contracts/bookmark";
export function SearchControls({query,tag,tags,onQuery,onTag}:{query:string;tag:string;tags:TagSummary[];onQuery:(v:string)=>void;onTag:(v:string)=>void}){
 return <div className="discovery"><div className="search"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="search">Search bookmarks</label><input id="search" type="search" value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search titles, links, notes, and tags…"/>{query&&<button aria-label="Clear search" onClick={()=>onQuery("")}>×</button>}</div><div className="filter-row" aria-label="Filter by tag"><button className={!tag?"filter active":"filter"} onClick={()=>onTag("")}>All <span>{tags.reduce((n,t)=>n+t.count,0)||""}</span></button>{tags.map(t=><button key={t.name} className={tag===t.name?"filter active":"filter"} onClick={()=>onTag(t.name)}>#{t.name} <span>{t.count}</span></button>)}</div></div>;
}
