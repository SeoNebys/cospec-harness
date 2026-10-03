"use client";
import { Star } from "lucide-react";
export function FavoriteFilter({active,onToggle}:{active:boolean;onToggle:()=>void}){return <button className={`chip ${active?"active":""}`} onClick={onToggle} aria-pressed={active}><Star size={14} fill={active?"currentColor":"none"}/> Favorites</button>}
