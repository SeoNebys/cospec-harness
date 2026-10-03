import type { RichTextNode } from '../api/types.js';

const blockTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote']);

export function noteToPlainText(root: RichTextNode): string {
  const walk = (node: RichTextNode): string => {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    const content = (node.content || []).map(walk).join('');
    return blockTypes.has(node.type) ? `${content}\n` : content;
  };
  return walk(root).replace(/[ \t]+\n/gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
}
