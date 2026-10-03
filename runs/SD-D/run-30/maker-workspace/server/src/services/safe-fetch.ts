import { resolvePublic } from '../security/dns-resolver.js';
import { Agent,fetch } from 'undici';

export async function safeFetch(url:string,options:{timeoutMs:number;maxBytes:number;accept:string;redirects?:number}):Promise<{url:string;contentType:string;bytes:Buffer}>{
  let current=new URL(url); const deadline=Date.now()+options.timeoutMs;
  for(let hop=0;hop<=Math.min(options.redirects??5,5);hop++){
    if(!['http:','https:'].includes(current.protocol)||current.username||current.password) throw new Error('BLOCKED_DESTINATION');
    const addresses=await resolvePublic(current.hostname);const pinned=addresses[0];
    const remaining=deadline-Date.now(); if(remaining<=0) throw new Error('TIMEOUT');
    const dispatcher=new Agent({connect:{lookup:(_hostname,_options,callback)=>callback(null,pinned,pinned.includes(':')?6:4)}});
    const response=await fetch(current,{dispatcher,redirect:'manual',signal:AbortSignal.timeout(remaining),headers:{accept:options.accept,'user-agent':'Keepmark/1.0 metadata preview'}});
    if(response.status>=300&&response.status<400){const location=response.headers.get('location');await dispatcher.close();if(!location||hop===5)throw new Error('UNREACHABLE');current=new URL(location,current);continue;}
    if(!response.ok){await dispatcher.close();throw new Error('UNREACHABLE');}
    const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase(); const reader=response.body?.getReader(); if(!reader)throw new Error('UNREACHABLE');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>options.maxBytes){await reader.cancel();await dispatcher.close();throw new Error('RESPONSE_TOO_LARGE')}chunks.push(value)}
    await dispatcher.close();return {url:current.toString(),contentType:type,bytes:Buffer.concat(chunks)};
  }
  throw new Error('UNREACHABLE');
}
