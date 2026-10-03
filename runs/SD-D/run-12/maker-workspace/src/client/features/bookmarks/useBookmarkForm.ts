import { useEffect, useRef, useState } from 'react';
import type { BookmarkWrite, MetadataResult } from '../../../shared/contracts/types.js';
import { retrieveMetadata } from '../../services/bookmarks.js';

export type FormState=BookmarkWrite&{loading:boolean;warning:string;error:string;titleDirty:boolean;descriptionDirty:boolean};
const initial:FormState={url:'',title:'',description:'',notes:'',tags:[],isFavorite:false,isUnread:false,iconUploadToken:null,loading:false,warning:'',error:'',titleDirty:false,descriptionDirty:false};
export function useBookmarkForm(open:boolean){
  const [form,setForm]=useState<FormState>(initial); const request=useRef(0);
  useEffect(()=>{if(!open)setForm(initial);},[open]);
  useEffect(()=>{ if(!open||!/^https?:\/\//i.test(form.url.trim()))return; const controller=new AbortController(); const timer=setTimeout(async()=>{const id=String(++request.current);setForm(f=>({...f,loading:true,warning:'',error:''}));try{const result:MetadataResult=await retrieveMetadata(form.url,id,controller.signal);if(id!==String(request.current))return;setForm(f=>({...f,url:result.finalUrl??result.normalizedUrl,title:f.titleDirty?f.title:result.metadata.title.value,description:f.descriptionDirty?f.description:result.metadata.description?.value??'',iconUploadToken:result.metadata.iconUploadToken,loading:false,warning:result.warnings.length?'Some page details were unavailable. You can still save this link.':''}));}catch(error){if((error as Error).name!=='AbortError')setForm(f=>({...f,loading:false,error:(error as Error).message}));}},550);return()=>{clearTimeout(timer);controller.abort();};},[form.url,open]);
  return {form,setForm};
}
