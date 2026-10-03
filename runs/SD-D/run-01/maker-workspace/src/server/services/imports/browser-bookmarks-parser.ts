import { parse } from 'parse5';
import { fallbackTitle, normalizeUrl } from '../../../shared/url/url-policy.js';

interface NodeLike{nodeName?:string;tagName?:string;value?:string;attrs?:Array<{name:string;value:string}>;childNodes?:NodeLike[]}
export interface ImportCandidate{url:string;canonicalKey:string;title:string;description:string;tags:string[];readLaterState:'none'|'unread';createdAt:string}
export interface ParseResult{entries:Array<ImportCandidate|{invalid:string}>;issues:string[]}
const generic=new Set(['bookmarks bar','favorites bar','other bookmarks','mobile bookmarks','bookmarks menu','favorites']);
const attr=(node:NodeLike,name:string)=>node.attrs?.find(a=>a.name.toLowerCase()===name.toLowerCase())?.value??'';
const text=(node:NodeLike):string=>node.nodeName==='#text'?node.value??'':(node.childNodes??[]).map(text).join('');
const clean=(value:string,max:number)=>Array.from(value.replace(/\s+/g,' ').trim()).slice(0,max).join('');

export function parseBrowserBookmarks(source:string):ParseResult{if(Buffer.byteLength(source)>10*1024*1024)throw new Error('Import file exceeds 10 MiB.');const doc=parse(source) as unknown as NodeLike;const entries:ParseResult['entries']=[];const issues:string[]=[];
  const walk=(node:NodeLike,folders:string[],depth:number)=>{if(depth>100)throw new Error('Bookmark folders exceed the depth limit.');const children=node.childNodes??[];let pendingFolder='';let lastEntry:ImportCandidate|undefined;for(const child of children){if(child.tagName==='h3'){pendingFolder=clean(text(child),60);continue;}if(child.tagName==='dl'){const next=pendingFolder&&!generic.has(pendingFolder.toLocaleLowerCase())?[...folders,pendingFolder]:folders;walk(child,next,depth+1);pendingFolder='';continue;}if(child.tagName==='a'){if(entries.length>=20000)throw new Error('Import contains more than 20,000 bookmarks.');const href=attr(child,'href');try{const normalized=normalizeUrl(href);const date=Number(attr(child,'add_date'));lastEntry={url:normalized.fetchUrl,canonicalKey:normalized.canonicalKey,title:clean(text(child),300)||fallbackTitle(normalized.fetchUrl),description:'',tags:[...new Set(folders)],readLaterState:attr(child,'com.apple.ReadingList')||attr(child,'reading_list')?'unread':'none',createdAt:Number.isFinite(date)&&date>0?new Date(date*1000).toISOString():new Date().toISOString()};entries.push(lastEntry);}catch{entries.push({invalid:'Unsupported or invalid web address'});if(issues.length<100)issues.push(`Skipped invalid address: ${clean(href,120)}`);}continue;}if(child.tagName==='dd'&&lastEntry){lastEntry.description=clean(text(child),1000);continue;}walk(child,folders,depth);}}
  walk(doc,[],0);
  const descriptions=[...source.matchAll(/<\/A>\s*<DD[^>]*>([^<]*)/gi)].map(match=>clean(match[1]?.replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')??'',1000));let descriptionIndex=0;for(const entry of entries){if(!('invalid'in entry)&&!entry.description&&descriptions[descriptionIndex])entry.description=descriptions[descriptionIndex]!;if(!('invalid'in entry))descriptionIndex++;}
  return{entries,issues};}
