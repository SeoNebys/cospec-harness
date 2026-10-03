import type { Page } from 'playwright';
export interface PageMetadata { title:string|null; description:string|null; faviconUrl:string|null; previewUrl:string|null }
export async function extractMetadata(page:Page):Promise<PageMetadata>{return page.evaluate(()=>{
  const content=(selectors:string[])=>selectors.map(s=>document.querySelector<HTMLMetaElement>(s)?.content?.trim()).find(Boolean)??null;
  const href=(selectors:string[])=>selectors.map(s=>document.querySelector<HTMLLinkElement>(s)?.href).find(Boolean)??null;
  return {title:content(['meta[property="og:title"]','meta[name="twitter:title"]'])||document.title.trim()||null,description:content(['meta[property="og:description"]','meta[name="description"]','meta[name="twitter:description"]']),faviconUrl:href(['link[rel~="icon"]','link[rel="shortcut icon"]']),previewUrl:content(['meta[property="og:image"]','meta[name="twitter:image"]'])};
});}
