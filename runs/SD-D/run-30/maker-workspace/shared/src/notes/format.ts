import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });
export function noteToHtml(source: string): string { return String(marked.parse(source)); }
export function noteToText(source: string): string {
  return source.replace(/<[^>]*>/g, ' ').replace(/!?(\[([^\]]*)\])\([^)]*\)/g, '$2').replace(/^#{1,6}\s+/gm, '').replace(/^\s*(?:[-*+] |\d+\. )/gm, '').replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
}
