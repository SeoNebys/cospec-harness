import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
const window=new JSDOM('').window;
const purify=DOMPurify(window as any);
marked.setOptions({gfm:true,breaks:true});
export function renderMarkdown(source:string){const withoutHtml=source.replace(/<[^>]*>/g,'');const rendered=marked.parse(withoutHtml,{async:false}) as string;return purify.sanitize(rendered,{ALLOWED_TAGS:['p','br','strong','em','del','h1','h2','h3','h4','ul','ol','li','blockquote','code','pre','a'],ALLOWED_ATTR:['href','title'],FORBID_ATTR:['style','target']}).replace(/<a /g,'<a rel="noopener noreferrer" target="_blank" ')}
export function markdownText(source:string){const dom=new JSDOM(renderMarkdown(source));return (dom.window.document.body.textContent??'').replace(/\s+/g,' ').trim()}
