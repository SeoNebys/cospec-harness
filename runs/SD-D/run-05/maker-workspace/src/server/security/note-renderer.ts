import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const schema = { ...defaultSchema, tagNames: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a"], attributes: { a: ["href"] }, protocols: { href: ["http", "https"] } };
export async function renderNote(markdown: string) {
  return String(await unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize, schema).use(rehypeStringify).process(markdown));
}
export function noteToText(markdown: string) { return markdown.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/^\s*(?:[-*+] |\d+\. )/gm, "").replace(/[\\*_`>]/g, "").trim(); }
