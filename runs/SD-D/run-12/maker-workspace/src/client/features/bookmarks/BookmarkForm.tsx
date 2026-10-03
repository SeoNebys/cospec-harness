import { useEffect, useRef, type FormEvent } from 'react';
import type { Bookmark } from '../../../shared/contracts/types.js';
import { createBookmark } from '../../services/bookmarks.js';
import { useBookmarkForm } from './useBookmarkForm.js';
import { TagCombobox } from '../tags/TagCombobox.js';

export function BookmarkForm({open,onClose,onSaved}:{open:boolean;onClose:()=>void;onSaved:(bookmark:Bookmark)=>void}){
  const {form,setForm}=useBookmarkForm(open);const urlRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(open)setTimeout(()=>urlRef.current?.focus(),0);},[open]);
  if(!open)return null;
  async function submit(event:FormEvent){event.preventDefault();setForm(f=>({...f,error:''}));try{const{url,title,description,notes,tags,isFavorite,isUnread,iconUploadToken}=form;onSaved(await createBookmark({url,title,description,notes,tags,isFavorite,isUnread,iconUploadToken}));onClose();}catch(error){setForm(f=>({...f,error:(error as Error).message}));}}
  return <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="add-title" className="dialog"><div className="dialog-head"><div><span className="eyebrow">New bookmark</span><h2 id="add-title">Save a link</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><form onSubmit={submit}>
    <label>Web address<input ref={urlRef} type="url" required placeholder="https://example.com/article" value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))}/></label>
    <div className="metadata-status" aria-live="polite">{form.loading?'Gathering page details…':form.warning}</div>
    <label>Title<input required maxLength={512} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value,titleDirty:true}))}/></label>
    <label>Description<textarea maxLength={2000} rows={2} value={form.description??''} onChange={e=>setForm(f=>({...f,description:e.target.value,descriptionDirty:true}))}/></label>
    <label>Personal notes<textarea maxLength={10000} rows={3} value={form.notes??''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label>
    <TagCombobox tags={form.tags??[]} onChange={tags=>setForm(f=>({...f,tags}))}/>
    <div className="check-row"><label><input type="checkbox" checked={form.isUnread} onChange={e=>setForm(f=>({...f,isUnread:e.target.checked}))}/> Add to read later</label><label><input type="checkbox" checked={form.isFavorite} onChange={e=>setForm(f=>({...f,isFavorite:e.target.checked}))}/> Favorite</label></div>
    {form.error&&<p className="form-error" role="alert">{form.error}</p>}<div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={form.loading||!form.title.trim()}>Save bookmark</button></div>
  </form></section></div>;
}
