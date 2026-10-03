"use client";
import type { TagDto } from "@/lib/bookmarks/types";
export function TagFilter({tags,selected,onToggle}:{tags:TagDto[];selected:string[];onToggle:(name:string)=>void}){if(!tags.length)return null;return <>{tags.map((tag)=><button key={tag.id} className={`chip ${selected.includes(tag.name)?"active":""}`} onClick={()=>onToggle(tag.name)} aria-pressed={selected.includes(tag.name)}>#{tag.name}</button>)}</>}
