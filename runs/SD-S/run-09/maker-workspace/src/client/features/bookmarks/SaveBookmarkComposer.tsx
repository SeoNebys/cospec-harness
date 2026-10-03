import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Bookmark, MetadataPreview } from "../../../shared/contracts/bookmarks.js";
import type { Folder, Tag } from "../../../shared/contracts/organization.js";
import { ApiClientError } from "../../../shared/contracts/errors.js";
import { bookmarkApi } from "./bookmark-api.js";
import { DuplicateDialog } from "./DuplicateDialog.js";

type Props={folders:Folder[];tags:Tag[];onSaved:(bookmark:Bookmark)=>void;onView:(id:number)=>void};

export function SaveBookmarkComposer({folders,tags,onSaved,onView}:Props){
  const [url,setUrl]=useState("");const [title,setTitle]=useState("");const [titleDirty,setTitleDirty]=useState(false);const [preview,setPreview]=useState<MetadataPreview>();
  const [loading,setLoading]=useState(false);const [more,setMore]=useState(false);const [notes,setNotes]=useState("");const [folderId,setFolderId]=useState("");const [tagIds,setTagIds]=useState<number[]>([]);const [favorite,setFavorite]=useState(false);
  const [error,setError]=useState("");const [saving,setSaving]=useState(false);const [duplicate,setDuplicate]=useState<{id:number;title:string;url:string}>();const controller=useRef<AbortController|null>(null);
  useEffect(()=>{
    controller.current?.abort();setPreview(undefined);setError("");
    if(!url.trim())return;
    try{const parsed=new URL(url.trim());if(!["http:","https:"].includes(parsed.protocol))return;}catch{return;}
    const timer=setTimeout(async()=>{const next=new AbortController();controller.current=next;setLoading(true);try{const result=await bookmarkApi.preview(url,next.signal);setPreview(result);if(!titleDirty)setTitle(result.title);}catch(error){if((error as Error).name!=="AbortError")setError("Page details aren’t available yet. You can still save this link.");}finally{if(controller.current===next)setLoading(false);}},500);
    return()=>{clearTimeout(timer);controller.current?.abort();};
  },[url,titleDirty]);
  function payload(saveAnyway=false){return{url,...(titleDirty&&title?{title}:{}),notes:notes||null,folderId:folderId?Number(folderId):null,tagIds,isFavorite:favorite,...(preview?.receipt?{metadataReceipt:preview.receipt}:{}),...(saveAnyway?{duplicateAction:"save_anyway" as const}:{})};}
  async function save(event?:FormEvent,saveAnyway=false){event?.preventDefault();setSaving(true);setError("");try{const bookmark=await bookmarkApi.create(payload(saveAnyway));onSaved(bookmark);setUrl("");setTitle("");setTitleDirty(false);setPreview(undefined);setNotes("");setFolderId("");setTagIds([]);setFavorite(false);setMore(false);setDuplicate(undefined);}catch(reason){if(reason instanceof ApiClientError&&reason.status===409&&reason.payload.existingBookmark)setDuplicate(reason.payload.existingBookmark);else setError(reason instanceof Error?reason.message:"The bookmark wasn’t saved. Please try again.");}finally{setSaving(false);}}
  return <section className="composer" aria-labelledby="save-heading"><div className="composer-heading"><div><span className="spark">✦</span><h2 id="save-heading">Save something worth keeping</h2></div><span className="shortcut">URL only — we’ll do the rest</span></div>
    <form onSubmit={(e)=>void save(e)}><div className="url-row"><div className="url-field"><span aria-hidden="true">↗</span><input aria-label="Web address" type="url" placeholder="Paste a link here…" value={url} onChange={(e)=>setUrl(e.target.value)} required /></div><button className="primary save-button" disabled={saving}>{saving?"Saving…":"Save link"}</button></div>
      {(loading||preview||titleDirty)&&<div className="preview-strip" aria-live="polite"><img src={preview?.iconDataUrl??"/generic-site-icon.svg"} alt=""/><div><span className="preview-label">{loading?"READING PAGE…":preview?.titleSource==="page"?"PAGE DETAILS":"FALLBACK DETAILS"}</span><input aria-label="Bookmark title" value={title} onChange={(e)=>{setTitle(e.target.value);setTitleDirty(true);}} placeholder="Bookmark title" maxLength={300}/>{preview&&preview.titleSource==="fallback"&&<small>We couldn’t read the page, but this link can still be saved.</small>}</div>{loading&&<span className="mini-spinner"/>}</div>}
      <button type="button" className="more-button" onClick={()=>setMore(!more)}>{more?"− Fewer options":"＋ Add details"}</button>
      {more&&<div className="composer-options"><label>Notes<textarea value={notes} onChange={(e)=>setNotes(e.target.value)} maxLength={10000} placeholder="Why are you saving this?"/></label><label>Folder<select value={folderId} onChange={(e)=>setFolderId(e.target.value)}><option value="">No folder</option>{folders.map((folder)=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><fieldset><legend>Tags</legend><div className="tag-picker">{tags.map((tag)=><label key={tag.id} className="check-chip"><input type="checkbox" checked={tagIds.includes(tag.id)} onChange={()=>setTagIds((current)=>current.includes(tag.id)?current.filter((id)=>id!==tag.id):[...current,tag.id])}/>{tag.name}</label>)}</div></fieldset><label className="favorite-check"><input type="checkbox" checked={favorite} onChange={(e)=>setFavorite(e.target.checked)}/> Save as favorite</label></div>}
      {error&&<p className="form-error" role="alert">{error}</p>}
    </form>
    {duplicate&&<DuplicateDialog existing={duplicate} onCancel={()=>setDuplicate(undefined)} onView={()=>{onView(duplicate.id);setDuplicate(undefined);}} onSave={()=>void save(undefined,true)}/>} 
  </section>;
}
