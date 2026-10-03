import type { Config } from '../config.js';
import { normalizeUrl } from './url-normalizer.js';
import { parseMetadata } from './metadata-parser.js';
import { safeFetch } from './safe-fetch.js';

export async function previewMetadata(input:string,config:Config){
 const {url,normalizedUrl}=normalizeUrl(input);
 try{
  const result=await safeFetch(url,{timeoutMs:config.metadataTimeoutMs,maxBytes:config.maxHtmlBytes,accept:'text/html,application/xhtml+xml',redirects:5});
  if(!['text/html','application/xhtml+xml'].includes(result.contentType))throw new Error('UNSUPPORTED_CONTENT');
  const metadata=parseMetadata(result.bytes.toString('utf8'),result.url);
  return {url,normalizedUrl,status:metadata.title?'complete':'partial',...metadata,reasonCode:metadata.title?null:'NO_METADATA'} as const;
 }catch(error){const reason=error instanceof Error&&['TIMEOUT','UNREACHABLE','BLOCKED_DESTINATION','UNSUPPORTED_CONTENT','RESPONSE_TOO_LARGE','NO_METADATA'].includes(error.message)?error.message:'UNREACHABLE';return {url,normalizedUrl,status:'unavailable' as const,title:null,iconCandidate:null,previewCandidate:null,reasonCode:reason};}
}
