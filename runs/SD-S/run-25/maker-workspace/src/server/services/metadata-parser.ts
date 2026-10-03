import { loadBuffer, type CheerioAPI } from 'cheerio';

const TITLE_LIMIT = 300;
const DESCRIPTION_LIMIT = 1_000;

export interface ParsedPageMetadata {
  title: string | null;
  description: string | null;
}

/**
 * Strip C0/C1 controls while retaining HTML whitespace long enough to collapse
 * it, then cap by Unicode code point rather than UTF-16 code unit.
 */
function normalizeMetadataText(value: string, maximum: number): string | null {
  const withoutControls = [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0)!;
      if (codePoint > 0x1f && (codePoint < 0x7f || codePoint > 0x9f)) {
        return character;
      }
      return character === '\t' || character === '\n' || character === '\r'
        ? ' '
        : '';
    })
    .join('');
  const normalized = withoutControls
    .replace(/\s+/gu, ' ')
    .trim();

  if (normalized === '') return null;
  return [...normalized].slice(0, maximum).join('');
}

function metaContent(
  $: CheerioAPI,
  attribute: 'name' | 'property',
  expectedValue: string,
): string | null {
  const expected = expectedValue.toLowerCase();

  for (const element of $('meta').toArray()) {
    const value = $(element).attr(attribute)?.trim().toLowerCase();
    if (value !== expected) continue;

    const content = normalizeMetadataText($(element).attr('content') ?? '', DESCRIPTION_LIMIT);
    if (content !== null) return content;
  }

  return null;
}

function firstValue(values: readonly (string | null)[]): string | null {
  return values.find((value): value is string => value !== null) ?? null;
}

/**
 * Parse a fetched HTML byte buffer without executing scripts or loading any
 * subresources. Cheerio's buffer loader performs HTML encoding sniffing before
 * parsing, including legacy encodings declared in an early meta element.
 */
export function parsePageMetadata(body: Uint8Array): ParsedPageMetadata {
  const buffer = Buffer.isBuffer(body)
    ? body
    : Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  const $ = loadBuffer(buffer, {
    // Modern pages and metadata responses are overwhelmingly UTF-8. Explicit
    // BOM/meta declarations still take precedence, preserving legacy support.
    encoding: { defaultEncoding: 'utf-8' },
  });

  const documentTitle = normalizeMetadataText($('title').first().text(), TITLE_LIMIT);
  const openGraphTitle = normalizeMetadataText(
    metaContent($, 'property', 'og:title') ?? '',
    TITLE_LIMIT,
  );
  const twitterTitle = normalizeMetadataText(
    firstValue([
      metaContent($, 'name', 'twitter:title'),
      metaContent($, 'property', 'twitter:title'),
    ]) ?? '',
    TITLE_LIMIT,
  );

  const standardDescription = metaContent($, 'name', 'description');
  const openGraphDescription = metaContent($, 'property', 'og:description');
  const twitterDescription = firstValue([
    metaContent($, 'name', 'twitter:description'),
    metaContent($, 'property', 'twitter:description'),
  ]);

  return {
    title: firstValue([documentTitle, openGraphTitle, twitterTitle]),
    description: firstValue([
      standardDescription,
      openGraphDescription,
      twitterDescription,
    ]),
  };
}
