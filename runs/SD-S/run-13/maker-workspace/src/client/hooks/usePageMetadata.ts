import { useRef, useState } from 'react';
import { retrieveMetadata } from '../api/bookmarks';
import type { MetadataResult } from '../../shared/types';
export function usePageMetadata(){
  const controller=useRef<AbortController|null>(null);const [state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle');const [message,setMessage]=useState('');
  const retrieve=async(url:string,onResult:(r:MetadataResult)=>void)=>{controller.current?.abort();const c=new AbortController();controller.current=c;setState('loading');setMessage('Reading page details…');try{const r=await retrieveMetadata(url,c.signal);onResult(r);setState('ready');setMessage(r.status==='fallback'?'Page details were unavailable. You can edit the fallback and save.':'Page details added.');return r;}catch(e:any){if(e.name==='AbortError')return;setState('error');setMessage(e.message||'Page details could not be read.');}};
  return {state,message,retrieve,cancel:()=>controller.current?.abort()};
}
