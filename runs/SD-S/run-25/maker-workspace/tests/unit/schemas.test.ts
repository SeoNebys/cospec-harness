import {
  bookmarkDescriptionSchema,
  bookmarkIdSchema,
  bookmarkInputSchema,
  bookmarkListQuerySchema,
  bookmarkTagsSchema,
  bookmarkTitleSchema,
  bookmarkUrlSchema,
  pageMetadataRequestSchema,
  readingStateSchema,
  readingStateUpdateSchema,
  sortOrderSchema,
  tagNameSchema,
} from '../../src/shared/schemas.js';

const atExactLength = (prefix: string, length: number): string =>
  prefix + 'a'.repeat(length - [...prefix].length);

describe('bookmark URL schema', () => {
  it.each(['http://example.com', 'https://example.com/path?query=yes#part'])(
    'accepts supported absolute URL %s',
    (url) => expect(bookmarkUrlSchema.parse(` ${url} `)).toBe(url),
  );

  it.each([
    '',
    'not a URL',
    '/relative',
    'ftp://example.com/file',
    'https://user@example.com/',
    'https://:password@example.com/',
  ])('rejects invalid or unsupported URL %j', (url) => {
    expect(bookmarkUrlSchema.safeParse(url).success).toBe(false);
  });

  it('enforces the inclusive 4,096-code-point boundary', () => {
    const valid = atExactLength('https://example.com/', 4_096);
    const invalid = `${valid}a`;
    expect(bookmarkUrlSchema.safeParse(valid).success).toBe(true);
    expect(bookmarkUrlSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('bookmark text and tag schemas', () => {
  it('trims titles and enforces non-empty and 300-code-point boundaries', () => {
    expect(bookmarkTitleSchema.parse('  Useful page  ')).toBe('Useful page');
    expect(bookmarkTitleSchema.safeParse('   ').success).toBe(false);
    expect(bookmarkTitleSchema.safeParse('😀'.repeat(300)).success).toBe(true);
    expect(bookmarkTitleSchema.safeParse('😀'.repeat(301)).success).toBe(false);
  });

  it('allows an empty description, trims it, and caps it at 2,000 code points', () => {
    expect(bookmarkDescriptionSchema.parse('   ')).toBe('');
    expect(bookmarkDescriptionSchema.parse('  Notes  ')).toBe('Notes');
    expect(bookmarkDescriptionSchema.safeParse('😀'.repeat(2_000)).success).toBe(true);
    expect(bookmarkDescriptionSchema.safeParse('😀'.repeat(2_001)).success).toBe(false);
  });

  it('enforces trimmed and normalized tag boundaries', () => {
    expect(tagNameSchema.parse('  Research  ')).toBe('Research');
    expect(tagNameSchema.safeParse(' ').success).toBe(false);
    expect(tagNameSchema.safeParse('😀'.repeat(40)).success).toBe(true);
    expect(tagNameSchema.safeParse('😀'.repeat(41)).success).toBe(false);
    expect(tagNameSchema.safeParse('ﬃ'.repeat(14)).success).toBe(false);
  });

  it('allows at most 20 tags', () => {
    expect(bookmarkTagsSchema.safeParse(Array.from({ length: 20 }, (_, i) => `tag-${i}`)).success)
      .toBe(true);
    expect(bookmarkTagsSchema.safeParse(Array.from({ length: 21 }, (_, i) => `tag-${i}`)).success)
      .toBe(false);
  });
});

describe('composed request schemas', () => {
  it('applies bookmark defaults, trims fields, and rejects unknown properties', () => {
    expect(
      bookmarkInputSchema.parse({ url: ' https://example.com ', title: ' Example ' }),
    ).toEqual({
      url: 'https://example.com',
      title: 'Example',
      description: '',
      tags: [],
      readingState: 'untracked',
      allowDuplicate: false,
    });
    expect(
      bookmarkInputSchema.safeParse({
        url: 'https://example.com',
        title: 'Example',
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it.each(['untracked', 'to_read', 'read'])(
    'accepts reading state %s',
    (state) => expect(readingStateSchema.safeParse(state).success).toBe(true),
  );

  it('rejects invalid reading states and strict update extras', () => {
    expect(readingStateSchema.safeParse('later').success).toBe(false);
    expect(
      readingStateUpdateSchema.safeParse({ readingState: 'read', extra: true }).success,
    ).toBe(false);
  });

  it.each(['newest', 'oldest', 'title'])(
    'accepts sort order %s',
    (sort) => expect(sortOrderSchema.safeParse(sort).success).toBe(true),
  );

  it('defaults and normalizes list query fields', () => {
    expect(bookmarkListQuerySchema.parse({})).toEqual({
      view: 'all',
      query: '',
      tag: [],
      sort: 'newest',
    });
    expect(bookmarkListQuerySchema.parse({ tag: ' Research ', query: ' term ' })).toEqual({
      view: 'all',
      query: 'term',
      tag: ['Research'],
      sort: 'newest',
    });
    expect(bookmarkListQuerySchema.safeParse({ query: '😀'.repeat(300) }).success).toBe(true);
    expect(bookmarkListQuerySchema.safeParse({ query: '😀'.repeat(301) }).success).toBe(false);
    expect(bookmarkListQuerySchema.safeParse({ view: 'queue' }).success).toBe(false);
  });

  it('reuses URL validation for metadata requests', () => {
    expect(pageMetadataRequestSchema.parse({ url: ' https://example.com ' })).toEqual({
      url: 'https://example.com',
    });
    expect(pageMetadataRequestSchema.safeParse({ url: 'file:///etc/passwd' }).success).toBe(false);
    expect(pageMetadataRequestSchema.safeParse({ url: 'https://example.com', extra: true }).success)
      .toBe(false);
  });

  it('accepts only UUID bookmark identifiers', () => {
    expect(bookmarkIdSchema.safeParse('00000000-0000-4000-8000-000000000001').success)
      .toBe(true);
    expect(bookmarkIdSchema.safeParse('bookmark-1').success).toBe(false);
  });
});
