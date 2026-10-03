import { parseWebAddress, websiteName } from './urls.js';

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .trim();
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeEntities(match[1]) : '';
}

function metaContent(html, keys) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = (attribute(tag, 'property') || attribute(tag, 'name')).toLocaleLowerCase();
    if (keys.includes(key)) return attribute(tag, 'content');
  }
  return '';
}

function titleContent(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, ' ')) : '';
}

function iconAddress(html, base) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = attribute(tag, 'rel').toLocaleLowerCase();
    if (rel.includes('icon')) {
      const href = attribute(tag, 'href');
      if (href) {
        const candidate = new URL(href, base);
        if (['http:', 'https:'].includes(candidate.protocol)) return candidate.href;
      }
    }
  }
  const fallback = new URL('/favicon.ico', base);
  return ['http:', 'https:'].includes(fallback.protocol) ? fallback.href : '';
}

export async function fetchPageDetails(address) {
  const parsed = parseWebAddress(address);
  try {
    const response = await fetch(parsed.href, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        'user-agent': 'TroveBookmarkReader/1.0',
        accept: 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) throw new Error(`Page responded with ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('Page did not return HTML');
    }
    const html = (await response.text()).slice(0, 1_500_000);
    const title = metaContent(html, ['og:title', 'twitter:title']) || titleContent(html);
    if (!title) throw new Error('Page did not provide a title');
    const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
    return {
      status: 'available',
      title,
      description,
      faviconUrl: iconAddress(html, response.url || parsed.href),
      siteName: websiteName(response.url || parsed.href)
    };
  } catch {
    return {
      status: 'unavailable',
      title: '',
      description: '',
      faviconUrl: '',
      siteName: websiteName(parsed.href)
    };
  }
}
