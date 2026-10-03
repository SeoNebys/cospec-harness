import type { Problem } from './types.ts';
export class ApiError extends Error { constructor(public problem:Problem){super(problem.detail??problem.title)} }
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(`/api${path}`,{...init,headers:{'Content-Type':'application/json',...init.headers}});if(!response.ok){let problem:Problem;try{problem=await response.json()}catch{problem={type:'about:blank',title:'Request failed',status:response.status}}throw new ApiError(problem);}if(response.status===204)return undefined as T;return response.json();}
