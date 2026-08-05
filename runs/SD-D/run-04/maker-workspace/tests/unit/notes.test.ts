import { describe, it, expect } from 'vitest';
import { renderNotes } from '../../src/server/services/notes';

describe('renderNotes (FR-003/FR-018)', () => {
  it('renders headings, bullets, and links', () => {
    const html = renderNotes('# Title\n\n- one\n- two\n\nSee [site](https://example.com)');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a>'
    );
  });

  it('renders bold and italic', () => {
    expect(renderNotes('**bold** and *italic*')).toContain('<strong>bold</strong>');
    expect(renderNotes('**bold** and *italic*')).toContain('<em>italic</em>');
  });

  it('escapes HTML so script cannot inject (FR-018)', () => {
    const html = renderNotes('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('leaves unsupported/link with bad scheme as plain text', () => {
    const html = renderNotes('[x](javascript:alert(1))');
    expect(html).not.toContain('<a ');
    expect(html).toContain('[x](javascript:alert(1))');
  });

  it('returns empty string for blank notes', () => {
    expect(renderNotes('')).toBe('');
    expect(renderNotes('   ')).toBe('');
  });
});
