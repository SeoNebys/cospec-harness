import { describe, expect, it } from "vitest";
import { noteToPlainText, validateNote } from "@/features/bookmarks/note-service";

describe("personal notes", () => {
  it("keeps readable text while removing markdown punctuation", () => {
    expect(noteToPlainText("# Heading\n\n**Bold** and [a link](https://example.com)\n\n- item\n\n`code`")).toBe("Heading Bold and a link item code");
  });

  it("accepts the 50,000 character boundary", () => {
    expect(validateNote("x".repeat(50_000))).toHaveLength(50_000);
  });

  it("rejects longer notes", () => {
    expect(() => validateNote("x".repeat(50_001))).toThrow("50,000");
  });
});
