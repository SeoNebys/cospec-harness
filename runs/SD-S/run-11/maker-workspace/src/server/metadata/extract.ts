import * as cheerio from 'cheerio';
import { LIMITS } from '../../shared/types/bookmark.ts';

function clean(value:string|undefined,limit:number){if(!value)return null;const safe=Array.from(value.normalize('NFKC')).filter(char=>{const code=char.charCodeAt(0);return code===9||code===10||code===13||code>=32&&code!==127}).join('');const cleaned=safe.replace(/\s+/gu,' ').trim();return cleaned?Array.from(cleaned).slice(0,limit).join(''):null;}
export function extractMetadata(buffer:Buffer){
  const $=cheerio.loadBuffer(buffer);
  const meta=(selector:string)=>$(selector).first().attr('content');
  const title=clean($('title').first().text()||meta('meta[property="og:title"]')||meta('meta[name="twitter:title"]'),LIMITS.title);
  const description=clean(meta('meta[property="og:description"]')||meta('meta[name="description"]')||meta('meta[name="twitter:description"]'),LIMITS.description);
  return {title,description};
}
