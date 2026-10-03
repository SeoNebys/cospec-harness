import type { MetadataPreview } from '../../shared/types/bookmark.ts';
import { normalizeBookmarkUrl } from '../../shared/url/normalize.ts';
import { extractMetadata } from './extract.ts';
import { retrieveHtml } from './transport.ts';

let active=0; const MAX_CONCURRENT=4;
export async function previewMetadata(rawUrl:string):Promise<MetadataPreview>{
  const {url}=normalizeBookmarkUrl(rawUrl);
  if(active>=MAX_CONCURRENT)throw Object.assign(new Error('Metadata service is busy.'),{status:429});
  active++;
  try { const page=await retrieveHtml(url);const data=extractMetadata(page.body);const status=data.title&&data.description?'available':data.title||data.description?'partial':'unavailable';return {normalizedUrl:url,status,title:data.title,description:data.description,message:status==='unavailable'?'We couldn’t load page details. You can still save this bookmark.':status==='partial'?'Some page details were not available. You can edit them before saving.':null}; }
  catch { return {normalizedUrl:url,status:'unavailable',title:null,description:null,message:'We couldn’t load page details. You can still save this bookmark.'}; }
  finally {active--;}
}
