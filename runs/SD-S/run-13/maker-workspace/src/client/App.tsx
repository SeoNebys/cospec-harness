import { useEffect, useState } from 'react';
import type { Bookmark, BookmarkInput, BookmarkList as List, SortOrder } from '../shared/types';
import { createBookmark, deleteBookmark, listBookmarks, updateBookmark } from './api/bookmarks';
import { AppShell } from './components/AppShell';
import { ConfirmDialog } from './components/ConfirmDialog';
import { BookmarkEditor } from './features/bookmarks/BookmarkEditor';
import { BookmarkList } from './features/bookmarks/BookmarkList';
import { EmptyLibrary } from './features/bookmarks/EmptyLibrary';
import { LibraryControls } from './features/bookmarks/LibraryControls';
import { NoResults } from './features/bookmarks/NoResults';
import { useDebounced } from './hooks/useBookmarkQuery';

export default function App(){
  const [data,setData]=useState<List>({items:[],total:0,tags:[]}),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [editor,setEditor]=useState<Bookmark|true|null>(null),[deleting,setDeleting]=useState<Bookmark|null>(null),[revision,setRevision]=useState(0);
  const [query,setQuery]=useState(''),[tag,setTag]=useState<string|undefined>(),[favorite,setFavorite]=useState(false),[sort,setSort]=useState<SortOrder>('newest');const debounced=useDebounced(query);
  useEffect(()=>{const c=new AbortController();setLoading(true);listBookmarks({query:debounced,tag,favorite:favorite||undefined,sort},c.signal).then(v=>{setData(v);setError('');setLoading(false)}).catch(e=>{if(e.name!=='AbortError'){setError(e.message);setLoading(false)}});return()=>c.abort();},[debounced,tag,favorite,sort,revision]);
  const refresh=()=>setRevision(v=>v+1);const clear=()=>{setQuery('');setTag(undefined);setFavorite(false)};
  const save=async(input:BookmarkInput,allowDuplicate:boolean)=>{if(editor&&editor!==true)await updateBookmark(editor.id,input);else await createBookmark({...input,allowDuplicate});refresh();};
  const remove=async()=>{if(!deleting)return;await deleteBookmark(deleting.id);setDeleting(null);refresh();};
  const filtered=Boolean(debounced||tag||favorite);
  return <AppShell ready={!loading&&!error}><main><section className="hero"><div><span className="eyebrow">Your quiet corner of the web</span><h1>Worth keeping.</h1><p>Save the pages that matter. Find them when they do.</p></div><button className="button primary add" onClick={()=>setEditor(true)}><span>＋</span> Add bookmark</button></section>
    {data.total>0||filtered?<><div className="library-heading"><h2>Library <span>{data.total}</span></h2></div><LibraryControls query={query} setQuery={setQuery} tag={tag} setTag={setTag} favorite={favorite} setFavorite={setFavorite} sort={sort} setSort={setSort} tags={data.tags}/></>:null}
    {loading?<div className="loading" role="status">Opening your library…</div>:error?<section className="empty"><h2>We couldn’t open your library.</h2><p>{error}</p><button className="button ghost" onClick={refresh}>Try again</button></section>:data.items.length?<BookmarkList items={data.items} onEdit={(bookmark)=>setEditor(bookmark)} onDelete={(bookmark)=>setDeleting(bookmark)}/>:filtered?<NoResults onClear={clear}/>:<EmptyLibrary onAdd={()=>setEditor(true)}/>} 
  </main>{editor&&<BookmarkEditor bookmark={editor===true?undefined:editor} onClose={()=>setEditor(null)} onSave={save}/>} {deleting&&<ConfirmDialog title="Delete this bookmark?" onCancel={()=>setDeleting(null)} onConfirm={()=>void remove()}>“{deleting.title}” will be permanently removed from your library.</ConfirmDialog>}</AppShell>
}
