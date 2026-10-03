import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export function useCollectionParams(){
  const [params,setParams]=useSearchParams();const urlQuery=params.get('q')||'';const [searchInput,setSearchInput]=useState(urlQuery);
  useEffect(()=>setSearchInput(urlQuery),[urlQuery]);
  useEffect(()=>{if(searchInput===urlQuery)return;const timer=window.setTimeout(()=>{const next=new URLSearchParams(params);if(searchInput)next.set('q',searchInput);else next.delete('q');next.delete('page');setParams(next,{replace:true});},250);return()=>window.clearTimeout(timer);},[searchInput,urlQuery,params,setParams]);
  const update=(key:string,value:string)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);next.delete('page');setParams(next,{replace:true});};
  return{params,setParams,searchInput,setSearchInput,update};
}
