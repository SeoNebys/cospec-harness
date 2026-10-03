import type { Bookmark,BookmarkInput,BookmarkPatch,BookmarkSort,BookmarkView,MetadataPreview,Tag } from '@bookmarks/shared';
import { api,ApiError } from './api';
export async function listBookmarks(view:BookmarkView,q='',tag='',sort:BookmarkSort='newest'){const p=new URLSearchParams({view,sort});if(q)p.set('q',q);if(tag)p.set('tag',tag);return api<{items:Bookmark[];total:number}>(`/bookmarks?${p}`)}
export const getBookmark=(id:string)=>api<Bookmark>(`/bookmarks/${id}`);
export const createBookmark=(input:BookmarkInput)=>api<Bookmark>('/bookmarks',{method:'POST',body:JSON.stringify(input)});
export const updateBookmark=(id:string,patch:BookmarkPatch)=>api<Bookmark>(`/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(patch)});
export const deleteBookmark=(id:string)=>api<void>(`/bookmarks/${id}`,{method:'DELETE'});
export const listTags=()=>api<Tag[]>('/tags');
export async function previewMetadata(url:string):Promise<MetadataPreview|{existingBookmarkId:string}>{const response=await fetch('/api/metadata/preview',{method:'POST',redirect:'manual',headers:{'content-type':'application/json'},body:JSON.stringify({url})});const body=await response.json();if(response.status===303)return body;if(!response.ok)throw new ApiError(body,response.status);return body}
