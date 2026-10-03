import { Agent, request } from "undici";
import { parseMetadata } from "./metadata-parser";
import { validateDestination } from "./network-policy";
import type { MetadataPreview } from "@/lib/contracts/metadata";

const MAX_BYTES=2*1024*1024, MAX_REDIRECTS=5;

export async function fetchMetadata(rawUrl: string): Promise<MetadataPreview> {
  const signal=AbortSignal.timeout(8000); let current=rawUrl;
  try {
    for (let redirects=0; redirects<=MAX_REDIRECTS; redirects++) {
      const safe=await validateDestination(current);
      const dispatcher=new Agent({ connect: { lookup: (_host,opts,cb) => opts.all ? cb(null,[{address:safe.address,family:safe.family}]) : cb(null,safe.address,safe.family) } });
      try {
        const response=await request(safe.url,{method:"GET",signal,dispatcher,headers:{accept:"text/html,application/xhtml+xml","user-agent":"KeptBookmarkPreview/1.0"}});
        if ([301,302,303,307,308].includes(response.statusCode)) {
          const location=Array.isArray(response.headers.location)?response.headers.location[0]:response.headers.location; await response.body.dump();
          if (!location || redirects===MAX_REDIRECTS) return {status:"unavailable",reason:"unavailable"};
          current=new URL(location,safe.url).toString(); continue;
        }
        const contentType=String(response.headers["content-type"]??"").toLowerCase();
        if (response.statusCode<200 || response.statusCode>=300) { await response.body.dump(); return {status:"unavailable",reason:"unavailable"}; }
        if (!(contentType.includes("text/html")||contentType.includes("application/xhtml+xml"))) { await response.body.dump(); return {status:"unavailable",reason:"unsupported_content"}; }
        const declared=Number(response.headers["content-length"]??0); if (declared>MAX_BYTES) { await response.body.dump(); return {status:"unavailable",reason:"unavailable"}; }
        const chunks:Buffer[]=[]; let size=0;
        for await (const chunk of response.body) { const b=Buffer.from(chunk); size+=b.length; if(size>MAX_BYTES){ response.body.destroy(); return {status:"unavailable",reason:"unavailable"}; } chunks.push(b); }
        const found=parseMetadata(Buffer.concat(chunks).toString("utf8"));
        const status=found.title&&found.description?"complete":found.title||found.description?"partial":"unavailable";
        return {...found,status,finalUrl:safe.url.toString(),...(status==="unavailable"?{reason:"metadata_missing" as const}:{})};
      } finally { await dispatcher.close(); }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name==="TimeoutError") return {status:"unavailable",reason:"timeout"};
    if (error instanceof Error && error.name==="TimeoutError") return {status:"unavailable",reason:"timeout"};
    if (error instanceof Error && error.constructor.name==="ValidationError") return {status:"unavailable",reason:error.message.includes("publicly")?"blocked_destination":"invalid_url"};
    return {status:"unavailable",reason:"unavailable"};
  }
  return {status:"unavailable",reason:"unavailable"};
}
