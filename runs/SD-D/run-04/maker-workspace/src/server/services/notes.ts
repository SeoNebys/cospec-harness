// Render a constrained Markdown subset (headings, bullet lists, links, and
// bold/italic emphasis) to safe HTML (FR-003/FR-018). Everything is HTML-escaped
// first, so anything outside the supported subset — including pasted markup or
// script — is shown as plain text and can never inject (FR-018).

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  return null;
}

/** Apply inline formatting to an already-escaped line: links, bold, italic. */
function inline(escaped: string): string {
  // Links: [text](url) — only http/https/mailto; otherwise left as literal text.
  let out = escaped.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, text: string, url: string) => {
    const href = safeHref(url);
    if (!href) return whole;
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  // Bold before italic so **x** isn't eaten by the single-* rule.
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return out;
}

/** Render the notes Markdown subset to sanitized HTML. */
export function renderNotes(md: string): string {
  if (!md || !md.trim()) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listOpen = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${paragraph.join('<br>')}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);

    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
    } else if (bullet) {
      flushParagraph();
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${inline(escapeHtml(bullet[1]))}</li>`);
    } else if (line.trim() === '') {
      flushParagraph();
      closeList();
    } else {
      closeList();
      paragraph.push(inline(escapeHtml(line)));
    }
  }
  flushParagraph();
  closeList();
  return html.join('');
}
