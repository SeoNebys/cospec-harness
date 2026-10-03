import type { Bookmark, BookmarkWrite, MetadataResult } from '../../shared/contracts/types.js';
import { apiRequest } from './api.js';

export type BookmarkListOptions={query?:string;tags?:string[];favorite?:boolean|null;unread?:boolean|null;cursor?:string;limit?:number};
export function listBookmarks(options:BookmarkListOptions={},signal?:AbortSignal){const params=new URLSearchParams();if(options.query)params.set('q',options.query);for(const tag of options.tags??[])params.append('tag',tag);if(options.favorite!==null&&options.favorite!==undefined)params.set('favorite',String(options.favorite));if(options.unread!==null&&options.unread!==undefined)params.set('unread',String(options.unread));if(options.cursor)params.set('cursor',options.cursor);if(options.limit)params.set('limit',String(options.limit));return apiRequest<{items:Bookmark[];nextCursor:string|null}>(`/api/bookmarks?${params}`,{signal});}
export function createBookmark(data:BookmarkWrite){return apiRequest<Bookmark>('/api/bookmarks',{method:'POST',body:JSON.stringify(data)});}
export function retrieveMetadata(url:string,requestId:string,signal?:AbortSignal){return apiRequest<MetadataResult>('/api/metadata',{method:'POST',body:JSON.stringify({url,requestId}),signal});}
export function getBookmark(id:number){return apiRequest<Bookmark>(`/api/bookmarks/${id}`)}
export function updateBookmark(id:number,patch:Partial<BookmarkWrite>){return apiRequest<Bookmark>(`/api/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(patch)})}
export function deleteBookmark(id:number){return apiRequest<void>(`/api/bookmarks/${id}`,{method:'DELETE'})}
