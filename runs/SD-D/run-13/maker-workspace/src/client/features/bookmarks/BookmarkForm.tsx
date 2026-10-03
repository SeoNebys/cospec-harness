import { useEffect, useState, type FormEvent } from 'react';
import type { Bookmark, RichTextDocument } from '../../../shared/api/types.js';
import { EMPTY_NOTE } from '../../../shared/notes/schema.js';
import { useMetadataPreview } from '../metadata/useMetadataPreview.js';
import { NoteEditor } from '../notes/NoteEditor.js';
import { TagCombobox } from '../tags/TagCombobox.js';
import { StatusRegion } from '../../components/StatusRegion.js';
import { useNavigate } from 'react-router';

export interface BookmarkFormValue { url:string;title:string;description:string|null;notes:RichTextDocument;tags:string[];favorite:boolean;toRead:boolean;metadataDraftId?:string|null }
export function BookmarkForm({ bookmark,onSubmit,submitLabel='Save bookmark',busy=false }: { bookmark?:Bookmark; onSubmit:(value:BookmarkFormValue)=>Promise<void>;submitLabel?:string;busy?:boolean }) {
  const navigate=useNavigate();
  const [value,setValue]=useState<BookmarkFormValue>({url:bookmark?.url||'',title:bookmark?.title||'',description:bookmark?.description||'',notes:bookmark?.notes||EMPTY_NOTE,tags:bookmark?.tags.map(t=>t.name)||[],favorite:bookmark?.favorite||false,toRead:bookmark?.toRead||false});
  const [dirty,setDirty]=useState({title:Boolean(bookmark),description:Boolean(bookmark)}); const [error,setError]=useState<string|null>(null);
  const metadata=useMetadataPreview(value.url,value.url!==bookmark?.url);
  useEffect(()=>{ const data=metadata.data;if(data?.kind==='metadata'){setValue(old=>({...old,title:dirty.title?old.title:data.title||old.title,description:dirty.description?old.description:data.description||old.description,metadataDraftId:data.draftId}));}},[metadata.data,dirty]);
  useEffect(()=>{const data=metadata.data;if(data?.kind==='existing')navigate(`/bookmarks/${data.bookmark.id}`,{state:{message:`Already saved${data.bookmark.archived?' in Archive':''}.`}});},[metadata.data,navigate]);
  const submit=async(event:FormEvent)=>{event.preventDefault();setError(null);try{await onSubmit({...value,title:value.title.trim(),description:value.description?.trim()||null});}catch(reason){setError(reason instanceof Error?reason.message:'Could not save the bookmark.');}};
  return <form className="bookmark-form" onSubmit={submit} noValidate>
    {metadata.data?.kind==='existing'&&<div className="notice warning">Already saved as <a href={`/bookmarks/${metadata.data.bookmark.id}`}>{metadata.data.bookmark.title}</a>{metadata.data.bookmark.archived?' in Archive':''}.</div>}
    <label>Web address <input type="url" required maxLength={4096} value={value.url} onChange={e=>setValue({...value,url:e.target.value,metadataDraftId:null})} placeholder="https://example.com/article" autoFocus={!bookmark}/></label>
    <StatusRegion message={metadata.loading?'Getting page details…':metadata.error?'Page details unavailable — you can still enter them yourself.':metadata.data?.kind==='metadata'&&metadata.data.status!=='complete'?'Some page details were unavailable. You can still save.':null}/>
    {metadata.data?.kind==='metadata'&&(metadata.data.previewImageUrl||metadata.data.iconUrl)&&<div className="metadata-preview">{metadata.data.previewImageUrl&&<img src={metadata.data.previewImageUrl} alt=""/>}{metadata.data.iconUrl&&<img className="preview-icon" src={metadata.data.iconUrl} alt=""/>}</div>}
    <label>Title <input required maxLength={300} value={value.title} onChange={e=>{setDirty({...dirty,title:true});setValue({...value,title:e.target.value});}}/></label>
    <label>Description <textarea rows={3} maxLength={2000} value={value.description||''} onChange={e=>{setDirty({...dirty,description:true});setValue({...value,description:e.target.value});}}/></label>
    <TagCombobox values={value.tags} onChange={tags=>setValue({...value,tags})}/>
    <fieldset className="inline-options"><legend>Bookmark options</legend><label><input type="checkbox" checked={value.toRead} onChange={e=>setValue({...value,toRead:e.target.checked})}/> To read</label><label><input type="checkbox" checked={value.favorite} onChange={e=>setValue({...value,favorite:e.target.checked})}/> Favorite</label></fieldset>
    <div><label className="field-label">Notes</label><p className="hint">Add context with headings, lists, quotes, bold, and italic text.</p><NoteEditor value={value.notes} onChange={notes=>setValue({...value,notes})}/></div>
    {error&&<div className="notice error" role="alert">{error}</div>}
    <div className="form-actions"><button className="button primary" disabled={busy||metadata.data?.kind==='existing'}>{busy?'Saving…':submitLabel}</button></div>
  </form>;
}
