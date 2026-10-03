import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";

export interface FormattedNoteProps {
  markdown: string;
  className?: string;
}

const allowedElements = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "a",
  "code",
] as const;

function safeLink(href: string | undefined): boolean {
  if (!href) return false;
  if (href.startsWith("#") || href.startsWith("/")) return true;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function SafeAnchor({ href, children }: ComponentPropsWithoutRef<"a"> & { children?: ReactNode }) {
  if (!safeLink(href)) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function FormattedNote({ markdown, className = "" }: FormattedNoteProps) {
  if (!markdown.trim()) return null;
  return (
    <div className={`formatted-note ${className}`.trim()}>
      <ReactMarkdown
        skipHtml
        allowedElements={[...allowedElements]}
        unwrapDisallowed
        urlTransform={(url) => (safeLink(url) ? url : "")}
        components={{ a: SafeAnchor }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
