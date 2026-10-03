import http from 'node:http';
import https from 'node:https';
import { resolvePublic, validateFetchUrl } from './address-policy.ts';

export interface RetrievedPage { url:string; body:Buffer; contentType:string }
export async function retrieveHtml(initial:string, timeoutMs=4000, maxBytes=1024*1024, maxRedirects=5):Promise<RetrievedPage>{
  const deadline=Date.now()+timeoutMs; let current=validateFetchUrl(initial);
  for(let hop=0;hop<=maxRedirects;hop++){
    const remaining=deadline-Date.now(); if(remaining<=0)throw new Error('timeout');
    const address=await resolvePublic(current.hostname); const result=await requestOnce(current,address,remaining,maxBytes);
    if(result.redirect){if(hop===maxRedirects)throw new Error('too many redirects');current=validateFetchUrl(new URL(result.redirect,current).toString());continue;}
    return {url:current.toString(),body:result.body!,contentType:result.contentType!};
  }
  throw new Error('unavailable');
}
function requestOnce(url:URL,address:{address:string;family:number},timeout:number,maxBytes:number):Promise<{redirect?:string;body?:Buffer;contentType?:string}>{
  return new Promise((resolve,reject)=>{
    const client=url.protocol==='https:'?https:http;
    const req=client.request(url,{method:'GET',headers:{Accept:'text/html, application/xhtml+xml','Accept-Encoding':'identity','User-Agent':'Bookkeep/1.0'},lookup:(_host,opts,cb)=>{if(opts.all)(cb as (error:null,addresses:Array<{address:string;family:number}>)=>void)(null,[address]);else(cb as (error:null,address:string,family:number)=>void)(null,address.address,address.family);}},res=>{
      const status=res.statusCode??0;if([301,302,303,307,308].includes(status)){res.resume();return resolve({redirect:res.headers.location});}
      const type=String(res.headers['content-type']??'').split(';')[0]!.trim().toLowerCase();if(status<200||status>=300||!['text/html','application/xhtml+xml'].includes(type)){res.resume();return reject(new Error('not html'));}
      const advertised=Number(res.headers['content-length']??0);if(advertised>maxBytes){res.resume();return reject(new Error('too large'));}
      const chunks:Buffer[]=[];let size=0;res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>maxBytes){req.destroy(new Error('too large'));return;}chunks.push(chunk);});res.on('end',()=>resolve({body:Buffer.concat(chunks),contentType:type}));
    });
    req.setTimeout(timeout,()=>req.destroy(new Error('timeout')));req.on('error',reject);req.end();
  });
}
