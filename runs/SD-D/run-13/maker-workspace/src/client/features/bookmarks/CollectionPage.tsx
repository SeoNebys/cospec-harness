import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { BookmarkPage, CollectionView, Preferences } from '../../../shared/api/types.js';
import { api, ApiClientError } from '../../lib/api-client.js';
import { queryKeys } from '../../lib/query-keys.js';
import { BookmarkList } from './BookmarkList.js';
import { SearchControls } from '../search/SearchControls.js';
import { useCollectionParams } from '../search/useCollectionParams.js';

const copy=new Map<CollectionView,{title:string;empty:string}>([['active',{title:'Your bookmarks',empty:'Save your first link to start your collection.'}],['to-read',{title:'To Read',empty:'Nothing waiting to be read.'}],['archive',{title:'Archive',empty:'Archived bookmarks will appear here.'}]]);
export function CollectionPage({view}:{view:CollectionView}){
  const {params,setParams,searchInput,setSearchInput,update}=useCollectionParams(); const client=useQueryClient();
  const preferences=useQuery({queryKey:queryKeys.preferences,queryFn:()=>api<Preferences>('/api/preferences')});
  const sort=params.get('sort')||preferences.data?.sortField||'createdAt'; const direction=params.get('direction')||preferences.data?.sortDirection||'desc';
  const query=new URLSearchParams(params);query.set('view',view);query.set('sort',sort);query.set('direction',direction);
  const result=useQuery({queryKey:queryKeys.bookmarks(query.toString()),queryFn:()=>api<BookmarkPage>(`/api/bookmarks?${query}`),enabled:Boolean(preferences.data)});
  const preferenceMutation=useMutation({mutationFn:(next:Partial<Preferences>)=>api<Preferences>('/api/preferences',{method:'PATCH',body:JSON.stringify(next)}),onSuccess:(value)=>client.setQueryData(queryKeys.preferences,value)});
  const heading=copy.get(view)!; const syntaxError=result.error instanceof ApiClientError&&result.error.payload.code==='SEARCH_SYNTAX_ERROR';const searchError=syntaxError?(result.error as ApiClientError).payload as {message:string;start?:number;end?:number}:null;
  return <section className="page" data-harness-ready={result.isSuccess?'true':undefined}><div className="page-heading"><div><p className="eyebrow">{view==='active'?'Collection':view==='to-read'?'Reading queue':'Stored away'}</p><h1>{heading.title}</h1></div>{view==='active'&&<Link className="button primary" to="/bookmarks/new">Add bookmark</Link>}</div>
    <SearchControls searchInput={searchInput} onSearchInput={setSearchInput} tag={params.get('tag')||''} favorite={params.get('favorite')==='true'} sort={sort} direction={direction} onFilter={update} onSort={value=>{const next=new URLSearchParams(params);next.set('sort',value.sortField);next.set('direction',value.sortDirection);setParams(next,{replace:true});preferenceMutation.mutate(value);}} onClear={()=>{setSearchInput('');setParams({sort,direction});}} error={searchError}/>
    {result.isLoading&&<div className="loading" role="status">Loading bookmarks…</div>}
    {result.error&&<div className="notice error" role="alert">{syntaxError?result.error.message:'Bookmarks could not be loaded. Try again.'}</div>}
    {result.data&&<><p className="result-count" role="status">{result.data.total} {result.data.total===1?'bookmark':'bookmarks'}</p>{result.data.items.length?<BookmarkList items={result.data.items}/>:<div className="empty-state"><h2>{params.toString()?'No matching bookmarks':heading.empty}</h2>{params.toString()?<button className="button" onClick={()=>setParams({})}>Clear search and filters</button>:view==='active'?<Link className="button primary" to="/bookmarks/new">Add a bookmark</Link>:null}</div>}</>}
  </section>;
}
