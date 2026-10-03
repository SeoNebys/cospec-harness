import { load } from 'cheerio';
function absolute(value:string|undefined,base:string){if(!value)return null;try{return new URL(value,base).toString()}catch{return null}}
export function parseMetadata(html:string,base:string){
  const $=load(html); const title=($('meta[property="og:title"]').attr('content')||$('title').first().text()).trim()||null;
  const icon=absolute($('link[rel~="icon"]').first().attr('href'),base);
  const preview=absolute($('meta[property="og:image"]').attr('content')||$('meta[name="twitter:image"]').attr('content'),base);
  return {title:title?.slice(0,200)||null,iconCandidate:icon,previewCandidate:preview};
}
