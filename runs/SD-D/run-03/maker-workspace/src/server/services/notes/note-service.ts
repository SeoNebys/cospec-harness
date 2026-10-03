import type { ListItem, PhrasingContent, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString as mdastToString } from "mdast-util-to-string";

import {
  isSafeNoteLinkUrl,
  NoteValidationError,
  type PreparedNote,
  type SafeNoteNode,
  type SafeNoteRoot,
} from "../../../shared/types/notes.js";

/** Keep editable source stable across operating systems without altering hard breaks. */
export function canonicalizeNoteMarkdown(markdown: string): string {
  return markdown.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
}

function childrenOf(nodes: readonly PhrasingContent[]): SafeNoteNode[] {
  return nodes.flatMap((node) => {
    const safe = safePhrasing(node);
    return safe ? [safe] : [];
  });
}

function safePhrasing(node: PhrasingContent): SafeNoteNode | null {
  switch (node.type) {
    case "text":
      return {
        type: "text",
        value: mdastToString(node, { includeHtml: false, includeImageAlt: false }),
      };
    case "inlineCode":
      return {
        type: "inlineCode",
        value: mdastToString(node, { includeHtml: false, includeImageAlt: false }),
      };
    case "break":
      return { type: "break" };
    case "strong":
      return { type: "strong", children: childrenOf(node.children) };
    case "emphasis":
      return { type: "emphasis", children: childrenOf(node.children) };
    case "link": {
      if (!isSafeNoteLinkUrl(node.url)) throw new NoteValidationError(node.url);
      return {
        type: "link",
        url: node.url,
        title: node.title ?? null,
        children: childrenOf(node.children),
      };
    }
    default:
      return null;
  }
}

function safeListItem(node: ListItem): SafeNoteNode {
  return {
    type: "listItem",
    children: node.children.flatMap((child) => {
      const safe = safeBlock(child);
      return safe ? [safe] : [];
    }),
  };
}

function safeBlock(node: RootContent): SafeNoteNode | null {
  switch (node.type) {
    case "heading":
      return { type: "heading", depth: node.depth, children: childrenOf(node.children) };
    case "paragraph":
      return { type: "paragraph", children: childrenOf(node.children) };
    case "list":
      return {
        type: "list",
        ordered: node.ordered === true,
        start: node.start ?? null,
        children: node.children.map(safeListItem),
      };
    default:
      return null;
  }
}

export function parseSafeNoteAst(markdown: string): SafeNoteRoot {
  const parsed = fromMarkdown(markdown);
  return {
    type: "root",
    children: parsed.children.flatMap((child) => {
      const safe = safeBlock(child);
      return safe ? [safe] : [];
    }),
  };
}

function textForNode(node: SafeNoteNode): string {
  switch (node.type) {
    case "text":
    case "inlineCode":
      return node.value;
    case "break":
      return "\n";
    case "strong":
    case "emphasis":
    case "link":
    case "heading":
    case "paragraph":
      return node.children.map(textForNode).join("");
    case "root":
    case "list":
    case "listItem":
      return node.children.map(textForNode).join("\n");
  }
}

/** Derives only text the approved renderer can visibly display. */
export function extractNotePlainText(ast: SafeNoteRoot): string {
  return textForNode(ast)
    .split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function prepareNote(markdown: string): PreparedNote {
  const canonical = canonicalizeNoteMarkdown(markdown);
  const ast = parseSafeNoteAst(canonical);
  return { markdown: canonical, plainText: extractNotePlainText(ast), ast };
}
