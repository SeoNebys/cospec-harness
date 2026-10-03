"use client";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
export function SaveForm({onSave,pending}:{onSave:(url:string)=>Promise<void>;pending:boolean}){const[url,setUrl]=useState("");return <form className="save-panel" onSubmit={async(e)=>{e.preventDefault();if(!url.trim())return;await onSave(url);setUrl("");}}><label className="sr-only" htmlFor="save-url">Web address</label><input id="save-url" className="input" type="text" inputMode="url" placeholder="Paste a link to save…" value={url} onChange={(e)=>setUrl(e.target.value)} maxLength={2048} required/><button className="button button-primary" disabled={pending}>{pending?<><LoaderCircle size={17}/>Gathering details…</>:<>Save link <ArrowRight size={17}/></>}</button></form>}
