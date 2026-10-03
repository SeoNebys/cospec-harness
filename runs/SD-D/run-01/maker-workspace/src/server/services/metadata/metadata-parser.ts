import { parse } from 'parse5';

export interface ParsedMetadata { title: string; description: string; iconCandidates: string[] }
interface NodeLike { nodeName?: string; tagName?: string; value?: string; attrs?: Array<{name:string;value:string}>; childNodes?: NodeLike[] }

const clean = (value: string, max: number) => Array.from(value.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('');
const attr = (node: NodeLike, name: string) => node.attrs?.find(item => item.name.toLowerCase() === name)?.value ?? '';

export function parseMetadata(html: string, pageUrl: string): ParsedMetadata {
  const document = parse(html) as unknown as NodeLike;
  const meta = new Map<string, string>(); const icons: Array<{href:string;score:number}> = []; let title = '';
  const walk = (node: NodeLike) => {
    if (node.tagName === 'title' && !title) title = text(node);
    if (node.tagName === 'meta') {
      const key = (attr(node, 'property') || attr(node, 'name')).toLowerCase();
      const content = attr(node, 'content'); if (key && content && !meta.has(key)) meta.set(key, content);
    }
    if (node.tagName === 'link') {
      const rel = attr(node, 'rel').toLowerCase(); const href = attr(node, 'href');
      if (href && rel.split(/\s+/).some(value => ['icon','shortcut','apple-touch-icon'].includes(value))) {
        const sizes = attr(node, 'sizes'); const score = rel.includes('apple-touch') ? 40 : rel === 'icon' ? 30 : 20;
        const dimensions = /^(\d+)x(\d+)$/.exec(sizes)?.[1]; icons.push({ href, score: score + Math.min(Number(dimensions ?? 0), 512) / 1000 });
      }
    }
    node.childNodes?.forEach(walk);
  };
  const text = (node: NodeLike): string => node.nodeName === '#text' ? node.value ?? '' : (node.childNodes ?? []).map(text).join('');
  walk(document);
  const pickedTitle = meta.get('og:title') || meta.get('twitter:title') || title;
  const pickedDescription = meta.get('og:description') || meta.get('twitter:description') || meta.get('description') || '';
  const base = new URL(pageUrl); const unique = new Set<string>(); const iconCandidates: string[] = [];
  for (const item of icons.sort((a,b) => b.score-a.score)) { try { const value = new URL(item.href, base).href; if (!unique.has(value)) { unique.add(value); iconCandidates.push(value); } } catch { /* skip invalid */ } }
  const fallback = new URL('/favicon.ico', base).href; if (!unique.has(fallback)) iconCandidates.push(fallback);
  return { title: clean(pickedTitle, 300), description: clean(pickedDescription, 1000), iconCandidates };
}
