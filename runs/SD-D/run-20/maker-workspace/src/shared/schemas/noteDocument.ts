import { z } from 'zod';

const simpleMark = z.object({ type: z.enum(['bold', 'italic']) }).strict();
const linkMark = z
  .object({
    type: z.literal('link'),
    attrs: z.object({ href: z.string().max(2048) }).strict(),
  })
  .strict()
  .superRefine((mark, context) => {
    try {
      const url = new URL(mark.attrs.href);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch {
      context.addIssue({ code: 'custom', message: 'Links must use an absolute HTTP(S) address.' });
    }
  });

const textNode = z
  .object({
    type: z.literal('text'),
    text: z.string(),
    marks: z.array(z.union([simpleMark, linkMark])).optional(),
  })
  .strict();

const paragraphNode = z
  .object({ type: z.literal('paragraph'), content: z.array(textNode).optional() })
  .strict();

type ListNode = {
  type: 'bulletList' | 'orderedList';
  content: Array<{ type: 'listItem'; content: Array<z.infer<typeof paragraphNode> | ListNode> }>;
};

const listNode: z.ZodType<ListNode> = z.lazy(() =>
  z
    .object({
      type: z.enum(['bulletList', 'orderedList']),
      content: z
        .array(
          z
            .object({
              type: z.literal('listItem'),
              content: z.array(z.union([paragraphNode, listNode])).min(1),
            })
            .strict(),
        )
        .min(1),
    })
    .strict(),
);

export const noteDocumentSchema = z
  .object({
    type: z.literal('doc'),
    content: z.array(z.union([paragraphNode, listNode])),
  })
  .strict();

export type NoteDocument = z.infer<typeof noteDocumentSchema>;

export function extractNoteText(document: NoteDocument | null | undefined): string {
  if (!document) return '';
  const lines: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const value = node as { type?: string; text?: string; content?: unknown[] };
    if (value.type === 'text') {
      lines.push(value.text ?? '');
      return;
    }
    if (Array.isArray(value.content)) {
      for (const child of value.content) visit(child);
      if (['paragraph', 'listItem'].includes(value.type ?? '')) lines.push('\n');
    }
  };
  visit(document);
  return lines
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeNoteDocument(value: unknown): NoteDocument | null {
  if (value == null) return null;
  const document = noteDocumentSchema.parse(value);
  const text = extractNoteText(document);
  if (!text) return null;
  if ([...text].length > 5000)
    throw new z.ZodError([
      { code: 'custom', path: [], message: 'Note text must be 5,000 characters or fewer.', input: value },
    ]);
  return document;
}
