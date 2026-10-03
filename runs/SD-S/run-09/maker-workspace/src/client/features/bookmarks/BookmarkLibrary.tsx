import { useCallback, useEffect, useState } from "react";
import type { SessionResponse } from "../../../shared/contracts/auth.js";
import type { Folder,Tag } from "../../../shared/contracts/organization.js";
import type { Bookmark } from "../../../shared/contracts/bookmarks.js";
import { organizationApi } from "../organization/organization-api.js";
import { OrganizationSidebar } from "../organization/OrganizationSidebar.js";
import { SaveBookmarkComposer } from "./SaveBookmarkComposer.js";
import { LibraryControls } from "./LibraryControls.js";
import { BookmarkCard } from "./BookmarkCard.js";
import { useLibraryQuery } from "./useLibraryQuery.js";
import { useBookmarks } from "./useBookmarks.js";
import { useBookmarkMutations } from "./useBookmarkMutations.js";

export function BookmarkLibrary({session,signOut}:{session:NonNullable<SessionResponse>;signOut:()=>Promise<void>}){const[folders,setFolders]=useState<Folder[]>([]);const[tags,setTags]=useState<Tag[]>([]);const[orgLoaded,setOrgLoaded]=useState(false);const{query,setQuery,clear,serverParams}=useLibraryQuery();const library=useBookmarks(serverParams);const mutations=useBookmarkMutations(library.replace,library.remove);
  const refreshOrganization=useCallback(async()=>{const[nextFolders,nextTags]=await Promise.all([organizationApi.folders(),organizationApi.tags()]);setFolders(nextFolders);setTags(nextTags);setOrgLoaded(true);},[]);
  useEffect(()=>{const timer=setTimeout(()=>void refreshOrganization(),0);return()=>clearTimeout(timer);},[refreshOrganization]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();document.querySelector<HTMLInputElement>('[aria-label="Search bookmarks"]')?.focus();}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);
  if(library.loading&&!library.page)return <main className="center-state"><div className="spinner" aria-label="Loading your library"/></main>;
  if(library.error&&!library.page)return <main className="center-state error-state"><h1>Your library didn’t load</h1><p>{library.error}</p><button className="primary" onClick={()=>void library.reload()}>Try again</button></main>;
  const page=library.page!;const ready=orgLoaded;
  async function deleted(id:number){await mutations.remove(id);await refreshOrganization();}
  function view(id:number){document.getElementById(`bookmark-${id}`)?.scrollIntoView({behavior:"smooth",block:"center"});}
  return <div className="app-shell" {...(ready?{"data-harness-ready":"true"}:{})}><header className="topbar"><a className="logo" href="/" aria-label="Keep home"><span>K</span>Keep</a><div className="account"><div className="avatar">{session.user.name.slice(0,1).toUpperCase()}</div><div><strong>{session.user.name}</strong><small>{session.user.email}</small></div><button onClick={()=>void signOut()}>Sign out</button></div></header><div className="app-body"><OrganizationSidebar folders={folders} tags={tags} total={page.total} query={query} setQuery={setQuery} onRefresh={async()=>{await refreshOrganization();await library.reload();}}/><main className="content"><SaveBookmarkComposer folders={folders} tags={tags} onSaved={(bookmark)=>{library.prepend(bookmark);void refreshOrganization();if(bookmark.metadataStatus==="pending")setTimeout(()=>void library.reload(),5_000);}} onView={view}/><LibraryControls query={query} setQuery={setQuery} clear={clear} folders={folders} tags={tags} total={page.total}/>{mutations.message&&<div className="toast" role="status">{mutations.message}<button onClick={()=>mutations.setMessage("")}>×</button></div>}<section className="bookmark-list" aria-label="Bookmarks">{page.items.map((bookmark:Bookmark)=><BookmarkCard key={bookmark.id} bookmark={bookmark} folders={folders} tags={tags} onChange={(updated)=>{library.replace(updated);void refreshOrganization();}} onFavorite={()=>void mutations.favorite(bookmark)} onRetry={()=>void mutations.retry(bookmark)} onDelete={()=>deleted(bookmark.id)}/>)}</section>{page.items.length===0&&<div className="empty-state"><div className="empty-illustration">⌁</div><h2>{query.q||query.folderId||query.tagId||query.favorite?"No bookmarks match":"Your library is ready"}</h2><p>{query.q||query.folderId||query.tagId||query.favorite?"Try changing your search or filters.":"Paste your first link above. We’ll collect the title and site icon for you."}</p>{(query.q||query.folderId||query.tagId||query.favorite)&&<button onClick={clear}>Clear filters</button>}</div>}{page.nextCursor&&<button className="load-more" onClick={()=>void library.loadMore()}>Load more</button>}</main></div></div>;
}
