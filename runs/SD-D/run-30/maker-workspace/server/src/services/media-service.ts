import type { Config } from '../config.js';
import { safeFetch } from './safe-fetch.js';
const types=new Set(['image/png','image/jpeg','image/webp','image/gif']);
export async function downloadMedia(url:string,config:Config){const r=await safeFetch(url,{timeoutMs:config.metadataTimeoutMs,maxBytes:config.maxImageBytes,accept:'image/png,image/jpeg,image/webp,image/gif',redirects:5});if(!types.has(r.contentType))throw new Error('UNSUPPORTED_CONTENT');return r}
