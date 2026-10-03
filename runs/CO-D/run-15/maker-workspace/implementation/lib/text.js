const ENTITY_MAP = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"'
};

export function decodeEntities(value = '') {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const radix = code[1]?.toLowerCase() === 'x' ? 16 : 10;
      const raw = radix === 16 ? code.slice(2) : code.slice(1);
      const point = Number.parseInt(raw, radix);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return ENTITY_MAP[code.toLowerCase()] ?? entity;
  });
}

export function stripTags(value = '') {
  return decodeEntities(
    String(value)
      .replace(/<(br|\/p|\/div|\/li)>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const ALLOWED_TAGS = new Set(['b', 'strong', 'em', 'ul', 'ol', 'li', 'p', 'div', 'br']);

export function sanitizeRichText(value = '') {
  return String(value)
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<\/?[^>]+>|[^<]+/g, (token) => {
      if (!token.startsWith('<')) {
        return token
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;');
      }
      const match = token.match(/^<\s*(\/?)\s*([a-z0-9]+)[^>]*>$/i);
      if (!match) return '';
      const closing = Boolean(match[1]);
      const tag = match[2].toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (tag === 'br') return '<br>';
      return `<${closing ? '/' : ''}${tag}>`;
    });
}
