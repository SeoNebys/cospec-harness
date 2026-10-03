import { api, ApiClientError } from '../../app/api';

export type ReadLaterState='none'|'unread'|'read';
export interface Tag{id:string;name:string}
export interface Bookmark{id:string;url:string;title:string;description:string;notes:string;tags:Tag[];isFavorite:boolean;readLaterState:ReadLaterState;readLaterAddedAt:string|null;readAt:string|null;archived:boolean;archivedAt:string|null;iconUrl:string|null;createdAt:string;updatedAt:string}
export interface BookmarkInput{url:string;title:string;description:string;notes:string;tags:string[];isFavorite:boolean;readLaterState:ReadLaterState;previewToken?:string}
export interface MetadataPreview{url:string;canonicalKey:string;status:'retrieved'|'partial'|'fallback';title:string;description:string;iconAvailable:boolean;previewToken:string;warnings:string[]}
export interface BookmarkPage{items:Bookmark[];total:number;limit:number;offset:number}
export const previewMetadata=(url:string)=>api<MetadataPreview>('/metadata/preview',{method:'POST',body:JSON.stringify({url})});
export const createBookmark=(input:BookmarkInput)=>api<Bookmark>('/bookmarks',{method:'POST',body:JSON.stringify(input)});
export const updateBookmark=(id:string,input:Partial<BookmarkInput>&{archived?:boolean})=>api<Bookmark>(`/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(input)});
export const deleteBookmark=(id:string)=>api<void>(`/bookmarks/${id}`,{method:'DELETE'});
export const listBookmarks=(query:string)=>api<BookmarkPage>(`/bookmarks${query?'?'+query:''}`);
export const suggestTags=(value:string)=>api<{items:Tag[]}>(`/tags?suggest=${encodeURIComponent(value)}`);
export {ApiClientError};
