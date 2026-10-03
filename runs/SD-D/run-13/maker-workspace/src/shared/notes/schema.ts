import type { RichTextDocument, RichTextMark, RichTextNode } from '../api/types.js';
import { LIMITS } from '../config/limits.js';

export const EMPTY_NOTE: RichTextDocument = { type: 'doc', content: [{ type: 'paragraph' }] };
const containers = new Set(['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote']);
const blocks = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote']);
const allowed = new Set([...containers, 'text', 'hardBreak']);

function validateMark(mark: unknown): asserts mark is RichTextMark {
  if (!mark || typeof mark !== 'object') throw new Error('A note contains an invalid format.');
  const item = mark as Record<string, unknown>;
  if (!['bold', 'italic', 'link'].includes(String(item.type))) throw new Error('A note contains an unsupported format.');
  const keys = Object.keys(item);
  if (item.type === 'link') {
    if (keys.some((key) => key !== 'type' && key !== 'attrs')) throw new Error('A note link contains unsupported data.');
    const attrs = item.attrs as Record<string, unknown> | undefined;
    if (!attrs || Object.keys(attrs).some((key) => key !== 'href') || typeof attrs.href !== 'string') throw new Error('A note link is invalid.');
    let url: URL;
    try { url = new URL(attrs.href); } catch { throw new Error('A note link must be a complete web address.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A note link must use HTTP or HTTPS.');
  } else if (keys.some((key) => key !== 'type')) throw new Error('A note format contains unsupported data.');
}

export function validateNote(value: unknown): RichTextDocument {
  let nodes = 0;
  let textLength = 0;
  const visit = (raw: unknown, depth: number, root = false): RichTextNode => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The note document is invalid.');
    if (depth > 20 || ++nodes > 5_000) throw new Error('The note is too complex.');
    const node = raw as Record<string, unknown>;
    const type = String(node.type);
    if (!allowed.has(type) || (root && type !== 'doc') || (!root && type === 'doc')) throw new Error('The note contains an unsupported block.');
    const allowedKeys = type === 'text' ? ['type', 'text', 'marks'] : type === 'heading' ? ['type', 'attrs', 'content'] : type === 'hardBreak' ? ['type'] : ['type', 'content'];
    if (Object.keys(node).some((key) => !allowedKeys.includes(key))) throw new Error('The note contains unsupported data.');
    if (type === 'text') {
      if (typeof node.text !== 'string') throw new Error('The note contains invalid text.');
      textLength += [...node.text].length;
      if (textLength > 100_000) throw new Error('The note is too long.');
      if (node.marks !== undefined) {
        if (!Array.isArray(node.marks)) throw new Error('The note contains invalid formatting.');
        node.marks.forEach(validateMark);
      }
    }
    if (type === 'heading') {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      if (!attrs || Object.keys(attrs).some((key) => key !== 'level') || ![2, 3].includes(Number(attrs.level))) throw new Error('Only level 2 and 3 headings are supported.');
    }
    if (containers.has(type)) {
      if (node.content !== undefined && !Array.isArray(node.content)) throw new Error('The note block has invalid content.');
      if (type === 'doc' && !Array.isArray(node.content)) throw new Error('The note document must contain blocks.');
      const children = Array.isArray(node.content) ? node.content.map((child) => visit(child, depth + 1)) : [];
      if (type === 'doc' && children.some((child) => !blocks.has(child.type))) throw new Error('The note has an invalid top-level block.');
      if ((type === 'paragraph' || type === 'heading') && children.some((child) => child.type !== 'text' && child.type !== 'hardBreak')) throw new Error('The note has invalid inline content.');
      if ((type === 'bulletList' || type === 'orderedList') && children.some((child) => child.type !== 'listItem')) throw new Error('A list contains an invalid item.');
      if ((type === 'listItem' || type === 'blockquote') && children.some((child) => !blocks.has(child.type) || child.type === 'listItem')) throw new Error('The note block contains invalid content.');
    }
    return structuredClone(raw) as RichTextNode;
  };
  const result = visit(value, 0, true) as RichTextDocument;
  const serialized = JSON.stringify(result);
  if (new TextEncoder().encode(serialized).byteLength > LIMITS.noteJsonBytes) throw new Error('The formatted note is larger than 100 KiB.');
  return result;
}
