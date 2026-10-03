import { Fragment, type ReactNode } from 'react';
import type { NoteDocument } from '../../../shared/schemas/noteDocument';

type AnyNode = {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: { href?: string } }>;
  content?: AnyNode[];
};
function render(node: AnyNode, key: number): ReactNode {
  if (node.type === 'text') {
    let content: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') content = <strong>{content}</strong>;
      if (mark.type === 'italic') content = <em>{content}</em>;
      if (mark.type === 'link' && mark.attrs?.href)
        content = (
          <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        );
    }
    return <Fragment key={key}>{content}</Fragment>;
  }
  const children = node.content?.map(render);
  if (node.type === 'paragraph') return <p key={key}>{children}</p>;
  if (node.type === 'bulletList') return <ul key={key}>{children}</ul>;
  if (node.type === 'orderedList') return <ol key={key}>{children}</ol>;
  if (node.type === 'listItem') return <li key={key}>{children}</li>;
  return <Fragment key={key}>{children}</Fragment>;
}
export function NoteRenderer({ document }: { document: NoteDocument | null }) {
  return document ? <div className="note-renderer">{(document as AnyNode).content?.map(render)}</div> : null;
}
