import { AppError } from './errors.js';
import { sourceFromUrl } from './urls.js';

const ENTITY_MAP = new Map([
  ['amp', '&'], ['quot', '"'], ['apos', "'"], ['lt', '<'], ['gt', '>'], ['nbsp', ' ']
]);

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(digits, radix);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return ENTITY_MAP.get(entity.toLowerCase()) ?? match;
  });
}

function cleanText(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function attributesFromTag(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

export function extractPageMetadata(html, finalUrl) {
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => attributesFromTag(match[0]));
  const findMeta = (...names) => meta.find((attrs) => names.includes((attrs.property ?? attrs.name ?? '').toLowerCase()))?.content;
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = cleanText(findMeta('og:title', 'twitter:title') ?? titleMatch?.[1] ?? '');
  const description = cleanText(findMeta('description', 'og:description', 'twitter:description') ?? '');

  if (!title || !description) {
    throw new AppError('METADATA_UNAVAILABLE', 'We could not get this page’s title and description.', 422);
  }

  return { title, description, source: sourceFromUrl(finalUrl) };
}

export class MetadataClient {
  constructor({ timeoutMs = 8000, fetchImpl = fetch } = {}) {
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async retrieve(url) {
    try {
      const response = await this.fetchImpl(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { 'user-agent': 'PersonalBookmarkLibrary/1.0 (+bookmark metadata reader)' }
      });
      if (!response.ok) throw new Error(`Page returned ${response.status}`);
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('text/html')) throw new Error('Page is not HTML');
      const html = await response.text();
      return extractPageMetadata(html, response.url || url);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('METADATA_UNAVAILABLE', 'We could not get this page’s title and description.', 422);
    }
  }
}
