import { fetchMetadata } from "./metadata-fetcher";

const attempts=new Map<string,{count:number;reset:number}>();
export async function previewMetadata(url:string,key="local") {
  const now=Date.now(), value=attempts.get(key);
  if (!value || value.reset<now) attempts.set(key,{count:1,reset:now+60_000});
  else { value.count++; if(value.count>30) return null; }
  return fetchMetadata(url);
}
