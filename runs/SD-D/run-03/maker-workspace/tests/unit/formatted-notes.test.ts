import { extractNotePlainText, prepareNote } from "../../src/server/services/notes/note-service.js";
import {
  isSafeNoteLinkUrl,
  NOTE_ALLOWED_ELEMENTS,
  NOTE_ALLOWED_NODE_TYPES,
  NoteValidationError,
  type SafeNoteNode,
} from "../../src/shared/types/notes.js";

function nodeTypes(node: SafeNoteNode): string[] {
  return [node.type, ...(node.children?.flatMap(nodeTypes) ?? [])];
}

describe("formatted note processing", () => {
  it("normalizes source line endings and extracts visible text from every supported construct", () => {
    const note = prepareNote(
      [
        "# Reading notes\r",
        "\r",
        "A **bold** and *thoughtful* [reference](https://example.com) with `inline()` code.\r",
        "\r",
        "1. First item\r",
        "2. Second item  \r",
        "   continued\r",
        "\r",
        "- Final item\r",
      ].join("\n"),
    );

    expect(note.markdown).not.toContain("\r");
    expect(note.plainText).toBe(
      [
        "Reading notes",
        "A bold and thoughtful reference with inline() code.",
        "First item",
        "Second item",
        "continued",
        "Final item",
      ].join("\n"),
    );
    expect(new Set(nodeTypes(note.ast))).toEqual(
      new Set([
        "root",
        "heading",
        "text",
        "paragraph",
        "strong",
        "emphasis",
        "link",
        "inlineCode",
        "list",
        "listItem",
        "break",
      ]),
    );
  });

  it("preserves ordered and unordered list meaning in the safe AST", () => {
    const ast = prepareNote("1. Ordered\n2. Again\n\n- Unordered").ast;
    expect(ast.children).toMatchObject([
      { type: "list", ordered: true, start: 1 },
      { type: "list", ordered: false, start: null },
    ]);
  });

  it("keeps only the approved node and rendered-element allowlists", () => {
    expect(NOTE_ALLOWED_NODE_TYPES).toEqual([
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
    ]);
    expect(NOTE_ALLOWED_ELEMENTS).toEqual([
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
    ]);
  });

  it("excludes raw HTML, images, embedded media, and unsupported formatting", () => {
    const note = prepareNote(`
Visible before <script>alert("not executable")</script> visible after.

![tracking pixel](https://tracker.example/pixel.gif)

<video autoplay src="https://media.example/movie.mp4"></video>

> Unsupported quote

~~~js
window.evil = true
~~~

---

Still visible.
`);
    const types = nodeTypes(note.ast);

    expect(types).not.toContain("html");
    expect(types).not.toContain("image");
    expect(types).not.toContain("blockquote");
    expect(types).not.toContain("code");
    expect(types).not.toContain("thematicBreak");
    expect(note.plainText).not.toContain("tracking pixel");
    expect(note.plainText).not.toContain("movie.mp4");
    expect(note.plainText).not.toContain("Unsupported quote");
    expect(note.plainText).not.toContain("window.evil");
    expect(note.plainText).toContain("Visible before");
    expect(note.plainText).toContain("Still visible.");
    expect(JSON.stringify(note.ast)).not.toMatch(/<script|<video|javascript:/iu);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,%3Cscript%3Ealert(1)%3C/script%3E",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//example.com/protocol-relative",
  ])("rejects a dangerous or ambiguous link destination: %s", (url) => {
    expect(isSafeNoteLinkUrl(url)).toBe(false);
    expect(() => prepareNote(`[unsafe](${url})`)).toThrowError(NoteValidationError);
    try {
      prepareNote(`[unsafe](${url})`);
    } catch (error) {
      expect(error).toMatchObject({ code: "UNSAFE_NOTE_LINK", field: "noteMarkdown" });
    }
  });

  it.each([
    "https://example.com/path?q=one",
    "http://example.com",
    "mailto:reader@example.com",
    "#saved-heading",
  ])("accepts a safe link destination: %s", (url) => {
    expect(isSafeNoteLinkUrl(url)).toBe(true);
    expect(() => prepareNote(`[safe](${url})`)).not.toThrow();
  });

  it("derives plain text from a previously prepared safe AST", () => {
    const note = prepareNote("## One\n\nParagraph with **two**.\n\n- Three");
    expect(extractNotePlainText(note.ast)).toBe("One\nParagraph with two.\nThree");
  });

  it("handles an empty note as canonical empty source and search text", () => {
    expect(prepareNote("")).toEqual({
      markdown: "",
      plainText: "",
      ast: { type: "root", children: [] },
    });
  });
});
