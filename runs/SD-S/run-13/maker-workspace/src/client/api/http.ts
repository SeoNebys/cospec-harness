export class ApiError extends Error { constructor(message:string, public code:string, public status:number, public details:any={}){super(message);} }
export async function api<T>(path:string, init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);if(init.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(`/api${path}`,{...init,headers});
  if(!response.ok){ const body=await response.json().catch(()=>({error:{}})); throw new ApiError(body.error?.message||'Request failed.',body.error?.code||'REQUEST_FAILED',response.status,body.error); }
  return response.status===204 ? undefined as T : response.json();
}
