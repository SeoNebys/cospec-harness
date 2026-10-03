export function validateNote(value: string): string {
  if ([...value].length > 50_000) throw new Error("Personal notes can be at most 50,000 characters.");
  return value;
}

export function noteToPlainText(markdown: string): string {
  return markdown
    .replaceAll(/```[\s\S]*?```/g, (block) => block.replace(/^```[^\n]*|```$/g, ""))
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replaceAll(/^\s{0,3}(#{1,6}|>|[-+*]|\d+[.)])\s+/gm, "")
    .replaceAll(/[\*_~]/g, "")
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}
