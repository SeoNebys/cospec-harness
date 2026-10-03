import React from 'react';
import { renderMarkdown } from '../lib/markdown.js';

// Renders sanitized Markdown (FR-010).
export function MarkdownView({ source }) {
  if (!source) return null;
  // eslint-disable-next-line react/no-danger
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
