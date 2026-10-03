"use client";
import { useEffect,useRef } from "react";
import type { Bookmark } from "@/lib/contracts/bookmark";
export function DeleteDialog({bookmark,onCancel,onConfirm,busy}:{bookmark:Bookmark|null;onCancel:()=>void;onConfirm:()=>void;busy:boolean}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{if(bookmark&&!ref.current?.open)ref.current?.showModal();if(!bookmark&&ref.current?.open)ref.current.close();},[bookmark]);
 return <dialog ref={ref} onCancel={e=>{e.preventDefault();onCancel();}} onClose={onCancel} aria-labelledby="delete-title"><div className="dialog-mark">!</div><h2 id="delete-title">Remove this bookmark?</h2><p>“{bookmark?.title}” will be permanently removed. This can’t be undone.</p><div className="dialog-actions"><button className="quiet" onClick={onCancel} autoFocus>Keep it</button><button className="danger" onClick={onConfirm} disabled={busy}>{busy?"Removing…":"Remove bookmark"}</button></div></dialog>;
}
