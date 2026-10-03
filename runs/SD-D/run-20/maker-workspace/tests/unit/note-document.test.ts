import { expect, it } from 'vitest';
import { extractNoteText, normalizeNoteDocument } from '../../src/shared/schemas/noteDocument';
it('accepts approved formatting and extracts readable text', () => {
  const note = normalizeNoteDocument({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Read me', marks: [{ type: 'bold' }] }] },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Later',
                    marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  expect(extractNoteText(note)).toContain('Read me');
  expect(extractNoteText(note)).toContain('Later');
});
it('rejects unsafe links and unknown nodes', () => {
  expect(() =>
    normalizeNoteDocument({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          ],
        },
      ],
    }),
  ).toThrow();
  expect(() => normalizeNoteDocument({ type: 'doc', content: [{ type: 'image' }] })).toThrow();
});
