import type{Tag}from'../../shared/contracts/types.js';import{apiRequest}from'./api.js';
export function suggestTags(prefix:string,exclude:string[],signal?:AbortSignal){const params=new URLSearchParams({prefix});exclude.forEach(tag=>params.append('exclude',tag));return apiRequest<{items:Tag[]}>(`/api/tags?${params}`,{signal})}
