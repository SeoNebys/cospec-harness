"use client";
export function FilterSummary({active,onClear}:{active:boolean;onClear:()=>void}){return active?<button className="button button-ghost" onClick={onClear}>Clear all</button>:null;}
