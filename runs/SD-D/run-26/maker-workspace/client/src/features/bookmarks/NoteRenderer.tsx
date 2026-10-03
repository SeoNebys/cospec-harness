import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
export function NoteRenderer({ value }: { value: string }) {
  if (!value.trim()) return <p className="muted">No personal note.</p>;
  return (
    <div className="note-rendered">
      <Markdown
        rehypePlugins={[rehypeSanitize]}
        skipHtml
        disallowedElements={['img']}
        unwrapDisallowed
        urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : '')}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          )
        }}
      >
        {value}
      </Markdown>
    </div>
  );
}
