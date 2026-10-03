"use client";
import { Search } from "lucide-react";
export function SearchBox({value,onChange}:{value:string;onChange:(value:string)=>void}){return <div className="search-wrap"><Search className="search-icon" size={17}/><label className="sr-only" htmlFor="bookmark-search">Search bookmarks</label><input id="bookmark-search" className="input" type="search" value={value} onChange={(e)=>onChange(e.target.value)} placeholder="Search titles, notes, URLs, and tags…"/></div>}
