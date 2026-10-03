import { useEffect, useRef, useState } from 'react';
import type { Bookmark, BookmarkInput } from '../../../shared/types';
import { ApiError } from '../../api/http';
import { usePageMetadata } from '../../hooks/usePageMetadata';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { TagInput } from './TagInput';

const blank:BookmarkInput={url:'',title:'',description:null,notes:null,tags:[],isFavorite:false};
export function BookmarkEditor({bookmark,onClose,onSave}:{bookmark?:Bookmark;onClose:()=>void;onSave:(v:BookmarkInput,allowDuplicate:boolean)=>Promise<void>}){
  const [form,setForm]=useState<BookmarkInput>(bookmark?{url:bookmark.url,title:bookmark.title,description:bookmark.description,notes:bookmark.notes,tags:bookmark.tags,isFavorite:bookmark.isFavorite}:blank);
  const [titleDirty,setTitleDirty]=useState(false),[descriptionDirty,setDescriptionDirty]=useState(false);
  const [error,setError]=useState(''),[duplicate,setDuplicate]=useState(false),[saving,setSaving]=useState(false),[stale,setStale]=useState(false);
  const meta=usePageMetadata();const first=useRef(true);const dialog=useRef<HTMLElement>(null);useDialogFocus(dialog,onClose);
  const load=(replace=false)=>meta.retrieve(form.url,(r)=>{setForm(v=>({...v,url:r.finalUrl,title:replace||!titleDirty?r.title:v.title,description:replace||!descriptionDirty?r.description:v.description}));setStale(false);if(replace){setTitleDirty(false);setDescriptionDirty(false);}});
  useEffect(()=>{if(first.current){first.current=false;return;}setStale(Boolean(bookmark));if(bookmark)return;const id=setTimeout(()=>{if(form.url.trim())void load();},400);return()=>clearTimeout(id);},[form.url]);
  const submit=async(allow=false)=>{setSaving(true);setError('');try{await onSave({...form,description:form.description||null,notes:form.notes||null},allow);onClose();}catch(e){if(e instanceof ApiError&&e.code==='DUPLICATE_BOOKMARK'){setDuplicate(true);setError('This address is already in your library.');}else setError(e instanceof Error?e.message:'Could not save the bookmark.');}finally{setSaving(false)}};
  return <div className="overlay" role="presentation"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="editor-title" className="dialog editor"><div className="dialog-heading"><div><span className="eyebrow">{bookmark?'Update saved link':'New bookmark'}</span><h2 id="editor-title">{bookmark?'Edit bookmark':'Save something worth returning to'}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></div><form onSubmit={e=>{e.preventDefault();void submit(false)}}>
    <label htmlFor="url">Web address</label><div className="url-row"><input id="url" type="text" required maxLength={2048} autoFocus={!bookmark} placeholder="Paste a link…" value={form.url} onChange={e=>setForm(v=>({...v,url:e.target.value}))}/>{bookmark&&stale&&<button type="button" className="button small" onClick={()=>void load(true)}>Replace page details</button>}</div>
    <div className={`status ${meta.state}`} role="status">{stale?'Address changed. Refresh when you want to replace its page details.':meta.message}</div>
    <label htmlFor="title">Title</label><input id="title" required maxLength={200} value={form.title} onChange={e=>{setTitleDirty(true);setForm(v=>({...v,title:e.target.value}))}} placeholder="Filled from the page"/>
    <label htmlFor="description">Description <span className="hint">optional</span></label><textarea id="description" maxLength={500} rows={2} value={form.description||''} onChange={e=>{setDescriptionDirty(true);setForm(v=>({...v,description:e.target.value}))}} placeholder="A short page description"/>
    <label htmlFor="notes">Personal notes <span className="hint">optional</span></label><textarea id="notes" maxLength={2000} rows={3} value={form.notes||''} onChange={e=>setForm(v=>({...v,notes:e.target.value}))} placeholder="Why are you saving this?"/>
    <TagInput tags={form.tags} onChange={tags=>setForm(v=>({...v,tags}))}/>
    <label className="favorite-check"><input type="checkbox" checked={form.isFavorite} onChange={e=>setForm(v=>({...v,isFavorite:e.target.checked}))}/><span>Mark as favorite</span></label>
    {error&&<div className="form-error" role="alert">{error}{duplicate&&<button type="button" className="text-button" onClick={()=>void submit(true)}>Save another copy</button>}</div>}
    <div className="dialog-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving||!form.url.trim()||!form.title.trim()}>{saving?'Saving…':bookmark?'Save changes':'Save bookmark'}</button></div>
  </form></section></div>
}
