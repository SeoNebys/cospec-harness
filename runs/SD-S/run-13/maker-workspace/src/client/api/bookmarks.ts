import type { Bookmark, BookmarkInput, BookmarkList, CreateBookmarkInput, MetadataResult, SortOrder } from '../../shared/types';
import { api } from './http';
export const listBookmarks=(filters:{query:string;tag?:string;favorite?:boolean;sort:SortOrder},signal?:AbortSignal)=>{ const q=new URLSearchParams(); if(filters.query)q.set('query',filters.query);if(filters.tag)q.set('tag',filters.tag);if(filters.favorite)q.set('favorite','true');q.set('sort',filters.sort);return api<BookmarkList>(`/bookmarks?${q}`,{signal});};
export const createBookmark=(input:CreateBookmarkInput)=>api<Bookmark>('/bookmarks',{method:'POST',body:JSON.stringify(input)});
export const updateBookmark=(id:string,input:BookmarkInput)=>api<Bookmark>(`/bookmarks/${id}`,{method:'PUT',body:JSON.stringify(input)});
export const deleteBookmark=(id:string)=>api<void>(`/bookmarks/${id}`,{method:'DELETE'});
export const retrieveMetadata=(url:string,signal?:AbortSignal)=>api<MetadataResult>('/page-metadata',{method:'POST',body:JSON.stringify({url}),signal});
