export type Tag={id:string;name:string;count?:number};
export type Bookmark={id:string;url:string;title:string;description:string|null;noteMarkdown:string;noteHtml:string;readStatus:'unread'|'read';archivedAt:string|null;copyStatus:'pending'|'available'|'failed';capturePending:boolean;copyErrorCode:string|null;faviconUrl:string|null;previewImageUrl:string|null;createdAt:string;updatedAt:string;version:number;tags:Tag[];savedCopy?:{id:string;kind:'html'|'pdf';capturedAt:string;size:number;sourceUrl:string;matchesCurrentUrl:boolean}|null;candidateCopy?:{id:string;kind:'html'|'pdf';capturedAt:string;size:number;sourceUrl:string}|null};
const request=async<T>(url:string,init?:RequestInit):Promise<T>=>{const response=await fetch(url,{...init,headers:{...(init?.body instanceof FormData?{}:{'content-type':'application/json'}),...(init?.headers??{})}});if(!response.ok){const problem=await response.json().catch(()=>({detail:`Request failed (${response.status})`}));const error=new Error(problem.detail||problem.title);(error as any).offset=problem.offset;throw error}if(response.status===204)return undefined as T;return response.json()};
export const api={
 list:(params:Record<string,string>)=>request<{items:Bookmark[];total:number;page:number;pageSize:number}>(`/api/bookmarks?${new URLSearchParams(params)}`),
 get:(id:string)=>request<Bookmark>(`/api/bookmarks/${id}`),
 metadata:(url:string)=>request<any>(`/api/metadata?url=${encodeURIComponent(url)}`),
 create:(body:any)=>request<Bookmark>('/api/bookmarks',{method:'POST',body:JSON.stringify(body)}),
 update:(id:string,body:any)=>request<Bookmark>(`/api/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
 action:(id:string,action:string,body:any={})=>request<Bookmark>(`/api/bookmarks/${id}/${action}`,{method:'POST',body:JSON.stringify(body)}),
 remove:(id:string,count:number)=>request<any>(`/api/bookmarks/${id}?expectedCopies=${count}`,{method:'DELETE'}),
 bulk:(ids:string[],action:string,data:any={})=>request<any>('/api/bookmarks/bulk',{method:'POST',body:JSON.stringify({ids,action,...data})}),
 tags:()=>request<{items:Tag[]}>('/api/tags'),
 views:()=>request<{items:any[]}>('/api/saved-views'),
 saveView:(body:any,id?:string)=>request<any>(id?`/api/saved-views/${id}`:'/api/saved-views',{method:id?'PATCH':'POST',body:JSON.stringify(body)}),
 deleteView:(id:string)=>request<void>(`/api/saved-views/${id}`,{method:'DELETE'}),
 preferences:()=>request<any>('/api/preferences'),
 savePreferences:(body:any)=>request<any>('/api/preferences',{method:'PATCH',body:JSON.stringify(body)}),
 import:async(file:File)=>{const form=new FormData();form.append('file',file);return request<any>('/api/imports',{method:'POST',body:form})},
 importStatus:(id:string)=>request<any>(`/api/imports/${id}`)
};
