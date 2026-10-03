"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const allowedElements = ["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "ul", "ol", "li", "blockquote", "a", "code", "pre"];

export function NoteRenderer({ children }: { children: string }) {
  return (
    <div className="note-rendered">
      <ReactMarkdown
        skipHtml
        allowedElements={allowedElements}
        unwrapDisallowed
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        urlTransform={(url) => (/^https?:\/\//i.test(url) ? defaultUrlTransform(url) : "")}
        components={{
          a: ({ children: label, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{label}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
