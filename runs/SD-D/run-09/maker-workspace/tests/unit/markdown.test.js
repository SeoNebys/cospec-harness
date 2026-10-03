// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../src/web/lib/markdown.js';

describe('renderMarkdown', () => {
  it('renders basic Markdown formatting', () => {
    const html = renderMarkdown('# Title\n\n- one\n- two\n\n**bold** and `code`');
    expect(html).toContain('<h1');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('sanitizes dangerous content (no script execution)', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script> world');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Hello');
  });

  it('strips javascript: URLs from links', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:alert');
  });
});
