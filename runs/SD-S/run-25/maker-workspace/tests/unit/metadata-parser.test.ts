import { parsePageMetadata } from '../../src/server/services/metadata-parser.js';

const html = (markup: string): Buffer => Buffer.from(markup, 'utf8');

describe('page metadata parser', () => {
  it('prefers standard document metadata over Open Graph and Twitter values', () => {
    const result = parsePageMetadata(
      html(`<!doctype html><html><head>
        <title>Document title</title>
        <meta name="description" content="Document description">
        <meta property="og:title" content="Open Graph title">
        <meta property="og:description" content="Open Graph description">
        <meta name="twitter:title" content="Twitter title">
        <meta name="twitter:description" content="Twitter description">
      </head></html>`),
    );

    expect(result).toEqual({
      title: 'Document title',
      description: 'Document description',
    });
  });

  it('uses Open Graph before Twitter and skips empty higher-priority values', () => {
    expect(
      parsePageMetadata(
        html(`<head>
          <title>   </title>
          <meta property="og:title" content="Open Graph title">
          <meta name="twitter:title" content="Twitter title">
          <meta name="description" content="">
          <meta property="og:description" content="Open Graph description">
          <meta name="twitter:description" content="Twitter description">
        </head>`),
      ),
    ).toEqual({
      title: 'Open Graph title',
      description: 'Open Graph description',
    });

    expect(
      parsePageMetadata(
        html(`<head>
          <meta name="twitter:title" content="Twitter title">
          <meta name="twitter:description" content="Twitter description">
        </head>`),
      ),
    ).toEqual({
      title: 'Twitter title',
      description: 'Twitter description',
    });
  });

  it('decodes character references in title and description text', () => {
    expect(
      parsePageMetadata(
        html(`<head>
          <title>Research &amp; Development &#x1F680;</title>
          <meta name="description" content="Tom &amp; Jerry&#39;s notes">
        </head>`),
      ),
    ).toEqual({
      title: 'Research & Development 🚀',
      description: "Tom & Jerry's notes",
    });
  });

  it('collapses whitespace and removes control characters from both fields', () => {
    expect(
      parsePageMetadata(
        html(`<head>
          <title>  Alpha \u0007 Beta\t Gamma \u007f </title>
          <meta name="description" content=" First\n \u0001 second   line \u0085 ">
        </head>`),
      ),
    ).toEqual({
      title: 'Alpha Beta Gamma',
      description: 'First second line',
    });
  });

  it('returns partial and absent metadata without inventing body content', () => {
    expect(parsePageMetadata(html('<head><title>Only a title</title></head>'))).toEqual({
      title: 'Only a title',
      description: null,
    });
    expect(
      parsePageMetadata(
        html('<html><body><h1>Do not use this heading</h1><p>Or this text.</p></body></html>'),
      ),
    ).toEqual({ title: null, description: null });
  });

  it('recovers useful metadata from malformed HTML', () => {
    expect(
      parsePageMetadata(
        html('<html><head><title>Recovered</title><meta name=description content="Still useful"><body><div><'),
      ),
    ).toEqual({ title: 'Recovered', description: 'Still useful' });
  });

  it('sniffs a declared legacy encoding from the original byte buffer', () => {
    const legacyDocument = Buffer.concat([
      Buffer.from('<meta charset="windows-1252"><title>Caf', 'ascii'),
      Buffer.from([0xe9]),
      Buffer.from(' ', 'ascii'),
      Buffer.from([0x96]),
      Buffer.from(' r', 'ascii'),
      Buffer.from([0xe9]),
      Buffer.from('sum', 'ascii'),
      Buffer.from([0xe9]),
      Buffer.from('</title>', 'ascii'),
    ]);

    expect(parsePageMetadata(legacyDocument)).toEqual({
      title: 'Café – résumé',
      description: null,
    });
  });

  it('caps title and description by Unicode code points without splitting characters', () => {
    const result = parsePageMetadata(
      html(`<head>
        <title>${'😀'.repeat(310)}</title>
        <meta name="description" content="${'🚀'.repeat(1_010)}">
      </head>`),
    );

    expect(result.title).toBe('😀'.repeat(300));
    expect(result.description).toBe('🚀'.repeat(1_000));
    expect([...result.title!]).toHaveLength(300);
    expect([...result.description!]).toHaveLength(1_000);
  });

  it('returns markup-looking metadata as inert plain text', () => {
    expect(
      parsePageMetadata(
        html(`<head>
          <title>&lt;script&gt;alert(1)&lt;/script&gt;</title>
          <meta name="description" content="&lt;img src=x onerror=alert(1)&gt;">
        </head>`),
      ),
    ).toEqual({
      title: '<script>alert(1)</script>',
      description: '<img src=x onerror=alert(1)>',
    });
  });
});
