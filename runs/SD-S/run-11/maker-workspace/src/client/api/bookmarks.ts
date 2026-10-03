import { api } from './client.ts';import type {Bookmark,LibraryQuery,MetadataPreview,Tag} from './types.ts';
export type BookmarkInput={url:string;title?:string;description?:string;tags:string[];favorite:boolean};
export function listBookmarks(q:LibraryQuery){const p=new URLSearchParams({view:q.view,q:q.q,favorite:String(q.favorite),sort:q.sort});q.tags.forEach(t=>p.append('tag',t));return api<{items:Bookmark[];total:number}>(`/bookmarks?${p}`)}
export const createBookmark=(v:BookmarkInput)=>api<Bookmark>('/bookmarks',{method:'POST',body:JSON.stringify(v)});
export const updateBookmark=(id:string,v:Partial<BookmarkInput>)=>api<Bookmark>(`/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(v)});
export const archiveBookmark=(id:string)=>api<Bookmark>(`/bookmarks/${id}/archive`,{method:'POST'});
export const restoreBookmark=(id:string)=>api<Bookmark>(`/bookmarks/${id}/restore`,{method:'POST'});
export const deleteBookmark=(id:string)=>api<void>(`/bookmarks/${id}`,{method:'DELETE'});
export const listTags=(view:string)=>api<{items:Tag[]}>(`/tags?view=${view}`);
export const preview=(url:string,signal:AbortSignal)=>api<MetadataPreview>('/metadata-preview',{method:'POST',body:JSON.stringify({url}),signal});
