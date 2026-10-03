import { Agent, fetch } from "undici";
import { resolvePublic, validateFetchUrl } from "./network-policy";

export async function guardedFetch(input:string, signal:AbortSignal) {
  let current=validateFetchUrl(input);
  for(let redirects=0;redirects<=5;redirects++) {
    const answer=await resolvePublic(current.hostname);
    const dispatcher=new Agent({connect:{lookup(_host,opts,cb){
      if (opts.all) cb(null,[answer]);
      else cb(null,answer.address,answer.family);
    }}});
    const response=await fetch(current,{dispatcher,redirect:"manual",signal,headers:{"user-agent":"Keepsake Bookmark Preview/1.0","accept":"text/html,application/xhtml+xml,image/*;q=0.2","accept-encoding":"identity"}});
    if(response.status>=300&&response.status<400) {
      const location=response.headers.get("location"); await response.body?.cancel(); await dispatcher.close();
      if(!location) throw Object.assign(new Error("The page redirected without a destination."),{code:"UPSTREAM_ERROR"});
      if(redirects===5) throw Object.assign(new Error("The page redirected too many times."),{code:"REDIRECT_LIMIT"});
      const next=validateFetchUrl(new URL(location,current).toString());
      if(current.protocol==="https:"&&next.protocol==="http:") throw Object.assign(new Error("An insecure redirect was blocked."),{code:"DOWNGRADE_REDIRECT"});
      current=next; continue;
    }
    return {response,finalUrl:current.toString(),close:()=>dispatcher.close()};
  }
  throw Object.assign(new Error("The page redirected too many times."),{code:"REDIRECT_LIMIT"});
}
