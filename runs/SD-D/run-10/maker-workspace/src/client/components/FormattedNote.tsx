import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { noteAllowedElements } from '../../shared/schemas/note';

export function FormattedNote({ value }: { value: string }) {
  return (
    <div className="formatted-note">
      <Markdown
        skipHtml
        allowedElements={[...noteAllowedElements]}
        rehypePlugins={[rehypeSanitize]}
        urlTransform={(url) => (/^https?:\/\//i.test(url) ? url : '')}
        components={{ a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
      >
        {value}
      </Markdown>
    </div>
  );
}
