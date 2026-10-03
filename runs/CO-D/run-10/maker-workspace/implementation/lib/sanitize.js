const ALLOWED_TAGS = new Set(["p", "br", "ul", "ol", "li", "strong", "em", "b", "i"]);

export function sanitizeNoteHtml(value) {
  let html = String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "");
  html = html.replace(/<\/?([a-z\d]+)(?:\s[^>]*)?>/gi, (whole, name) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    return whole.startsWith("</") ? `</${tag}>` : tag === "br" ? "<br>" : `<${tag}>`;
  });
  return html.trim();
}

export function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>|<\/li>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
