export const NOTE_ALLOWED_NODE_TYPES = [
  "root",
  "heading",
  "paragraph",
  "text",
  "strong",
  "emphasis",
  "list",
  "listItem",
  "link",
  "inlineCode",
  "break",
] as const;

export type SafeNoteNodeType = (typeof NOTE_ALLOWED_NODE_TYPES)[number];

/** HTML elements the browser renderer may create from the safe Markdown subset. */
export const NOTE_ALLOWED_ELEMENTS = [
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
  "br",
] as const;

interface SafeNoteNodeBase {
  readonly type: SafeNoteNodeType;
  readonly children?: readonly SafeNoteNode[];
}

export interface SafeNoteRoot extends SafeNoteNodeBase {
  readonly type: "root";
  readonly children: readonly SafeNoteNode[];
}

export interface SafeNoteHeading extends SafeNoteNodeBase {
  readonly type: "heading";
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;
  readonly children: readonly SafeNoteNode[];
}

export interface SafeNoteParagraph extends SafeNoteNodeBase {
  readonly type: "paragraph";
  readonly children: readonly SafeNoteNode[];
}

export interface SafeNoteText extends SafeNoteNodeBase {
  readonly type: "text";
  readonly value: string;
}

export interface SafeNoteStrong extends SafeNoteNodeBase {
  readonly type: "strong";
  readonly children: readonly SafeNoteNode[];
}

export interface SafeNoteEmphasis extends SafeNoteNodeBase {
  readonly type: "emphasis";
  readonly children: readonly SafeNoteNode[];
}

export interface SafeNoteList extends SafeNoteNodeBase {
  readonly type: "list";
  readonly ordered: boolean;
  readonly start: number | null;
  readonly children: readonly SafeNoteNode[];
}

export interface SafeNoteListItem extends SafeNoteNodeBase {
  readonly type: "listItem";
  readonly children: readonly SafeNoteNode[];
}

export interface SafeNoteLink extends SafeNoteNodeBase {
  readonly type: "link";
  readonly url: string;
  readonly title: string | null;
  readonly children: readonly SafeNoteNode[];
}

export interface SafeNoteInlineCode extends SafeNoteNodeBase {
  readonly type: "inlineCode";
  readonly value: string;
}

export interface SafeNoteBreak extends SafeNoteNodeBase {
  readonly type: "break";
}

export type SafeNoteNode =
  | SafeNoteRoot
  | SafeNoteHeading
  | SafeNoteParagraph
  | SafeNoteText
  | SafeNoteStrong
  | SafeNoteEmphasis
  | SafeNoteList
  | SafeNoteListItem
  | SafeNoteLink
  | SafeNoteInlineCode
  | SafeNoteBreak;

export interface PreparedNote {
  readonly markdown: string;
  readonly plainText: string;
  readonly ast: SafeNoteRoot;
}

export class NoteValidationError extends Error {
  readonly code = "UNSAFE_NOTE_LINK";
  readonly field = "noteMarkdown";

  constructor(readonly url: string) {
    super("Note links must use http, https, mailto, or a page fragment.");
    this.name = "NoteValidationError";
  }
}

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isSafeNoteLinkUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  for (const character of trimmed) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) return false;
  }
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("//")) return false;

  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(trimmed).protocol.toLocaleLowerCase("en-US"));
  } catch {
    return false;
  }
}
