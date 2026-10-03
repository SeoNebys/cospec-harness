import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export default function SafeMarkdown({children}:{children:string}){return <div className="markdown"><ReactMarkdown rehypePlugins={[rehypeSanitize]} skipHtml components={{a:({node:_,...props})=><a {...props} target="_blank" rel="noopener noreferrer"/>}}>{children}</ReactMarkdown></div>;}
