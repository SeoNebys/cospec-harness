import * as cheerio from "cheerio";

const clean=(value:string|undefined,max:number)=>value?.replace(/\s+/g," ").trim().slice(0,max)||null;
export function extractMetadata(bytes:Buffer, baseUrl:string) {
  const $=cheerio.loadBuffer(bytes);
  const content=(selector:string,attr="content")=>$(selector).first().attr(attr);
  const title=clean(content('meta[property="og:title"]')||content('meta[name="twitter:title"]')||$("title").first().text(),300);
  const description=clean(content('meta[property="og:description"]')||content('meta[name="twitter:description"]')||content('meta[name="description"]'),1000);
  const icons=$("link[rel]").toArray().filter(el=>/\b(icon|apple-touch-icon)\b/i.test($(el).attr("rel")||"")).map(el=>$(el).attr("href")).filter(Boolean).map(href=>new URL(href!,baseUrl).toString());
  icons.push(new URL("/favicon.ico",baseUrl).toString());
  return {title,description,iconCandidates:[...new Set(icons)].slice(0,3)};
}
