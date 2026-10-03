import { guardedFetch } from "./transport";
import { extractMetadata } from "./extract";
import { config } from "@/lib/config";

async function boundedBody(response:Response,max:number) {
  const declared=Number(response.headers.get("content-length")||0); if(declared>max) throw Object.assign(new Error("The page is too large to preview."),{code:"CONTENT_TOO_LARGE"});
  const reader=response.body?.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  while(reader) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>max){await reader.cancel();throw Object.assign(new Error("The page is too large to preview."),{code:"CONTENT_TOO_LARGE"});} chunks.push(value); }
  return Buffer.concat(chunks.map(v=>Buffer.from(v)));
}

export async function fetchPageMetadata(input:string) {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),config.metadataTimeoutMs);
  try {
    const {response,finalUrl,close}=await guardedFetch(input,controller.signal);
    try {
      if(!response.ok) throw Object.assign(new Error(`The page returned ${response.status}.`),{code:"UPSTREAM_ERROR"});
      const type=response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if(type&&!["text/html","application/xhtml+xml"].includes(type)) throw Object.assign(new Error("This address does not point to a web page."),{code:"UNSUPPORTED_CONTENT"});
      const bytes=await boundedBody(response as unknown as Response,config.metadataMaxBytes);
      return {finalUrl,...extractMetadata(bytes,finalUrl)};
    } finally { await close(); }
  } catch(error) { if(controller.signal.aborted) throw Object.assign(new Error("The page took too long to respond."),{code:"TIMEOUT"}); throw error; }
  finally { clearTimeout(timer); }
}
