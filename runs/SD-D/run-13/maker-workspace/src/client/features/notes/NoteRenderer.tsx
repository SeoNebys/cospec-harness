import type { RichTextNode } from '../../../shared/api/types.js';
import type { ReactNode } from 'react';

function renderNode(node: RichTextNode, key: number): ReactNode {
  if (node.type === 'text') {
    let content: ReactNode = node.text || '';
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') content = <strong>{content}</strong>;
      if (mark.type === 'italic') content = <em>{content}</em>;
      if (mark.type === 'link' && mark.attrs?.href) content = <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">{content}</a>;
    }
    return <span key={key}>{content}</span>;
  }
  if (node.type === 'hardBreak') return <br key={key}/>;
  const children = node.content?.map(renderNode);
  if (node.type === 'heading') return node.attrs?.level === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>;
  if (node.type === 'bulletList') return <ul key={key}>{children}</ul>;
  if (node.type === 'orderedList') return <ol key={key}>{children}</ol>;
  if (node.type === 'listItem') return <li key={key}>{children}</li>;
  if (node.type === 'blockquote') return <blockquote key={key}>{children}</blockquote>;
  if (node.type === 'paragraph') return <p key={key}>{children}</p>;
  return <div key={key}>{children}</div>;
}

export function NoteRenderer({ note }: { note: RichTextNode }) { return <div className="formatted-note">{note.content?.map(renderNode)}</div>; }
