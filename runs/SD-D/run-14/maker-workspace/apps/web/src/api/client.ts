import type { Bookmark, BulkAction, Filters, Preferences, ResultSelector, SavedView, SavedViewInput, SortDirection, SortField } from '@bookmark/contracts';
export class ApiError extends Error { constructor(message:string,public status:number,public body:any){super(message)} }
async function request<T>(url:string,init?:RequestInit):Promise<T>{const r=await fetch(`/api${url}`,{...init,headers:{'Content-Type':'application/json',...(init?.headers??{})}});if(!r.ok){const body=await r.json().catch(()=>({}));throw new ApiError(body?.error?.message??'Request failed',r.status,body)}if(r.status===204)return undefined as T;return r.json() as Promise<T>}
export const api={
  list:(p:{q:string;filters:Filters;sort:SortField;direction:SortDirection})=>{const s=new URLSearchParams({q:p.q,sort:p.sort,direction:p.direction,archiveState:p.filters.archiveState??'active',limit:'100'});if(p.filters.readState)s.set('readState',p.filters.readState);if(p.filters.favorite!=null)s.set('favorite',String(p.filters.favorite));p.filters.tags?.forEach(t=>s.append('tag',t));return request<{items:Bookmark[];total:number;nextCursor:string|null}>(`/bookmarks?${s}`)},
  create:(body:any)=>request<Bookmark>('/bookmarks',{method:'POST',body:JSON.stringify(body)}),
  update:(id:string,body:any)=>request<Bookmark>(`/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  remove:(id:string)=>request<void>(`/bookmarks/${id}?confirm=true`,{method:'DELETE'}),
  refresh:(id:string,replaceUserMetadata=false)=>request<Bookmark>(`/bookmarks/${id}/refresh`,{method:'POST',body:JSON.stringify({replaceUserMetadata})}),
  tags:(q:string)=>request<{items:{id:string;name:string;usageCount:number}[]}>(`/tags?q=${encodeURIComponent(q)}`),
  views:()=>request<SavedView[]>('/saved-views'), createView:(v:SavedViewInput)=>request<SavedView>('/saved-views',{method:'POST',body:JSON.stringify(v)}), updateView:(id:string,v:SavedViewInput)=>request<SavedView>(`/saved-views/${id}`,{method:'PATCH',body:JSON.stringify(v)}), deleteView:(id:string)=>request<void>(`/saved-views/${id}`,{method:'DELETE'}),
  preferences:()=>request<Preferences>('/preferences'),savePreferences:(p:Preferences)=>request<Preferences>('/preferences',{method:'PATCH',body:JSON.stringify(p)}),
  bulkPreview:(selector:ResultSelector,action:BulkAction)=>request<{targetCount:number}>('/bulk/preview',{method:'POST',body:JSON.stringify({selector,action})}),
  bulkExecute:(selector:ResultSelector,action:BulkAction,count:number)=>request<any>('/bulk/execute',{method:'POST',body:JSON.stringify({selector,action,confirmedTargetCount:count})})
};
