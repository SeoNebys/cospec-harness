const entityMap = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['#39', "'"]
]);

function decodeEntities(value = '') {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const lowered = entity.toLowerCase();
    if (entityMap.has(lowered)) return entityMap.get(lowered);
    if (lowered.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lowered.slice(2), 16));
    if (lowered.startsWith('#')) return String.fromCodePoint(Number.parseInt(lowered.slice(1), 10));
    return match;
  });
}

function cleanText(value = '') {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function metaContent(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return cleanText(match[1]);
    }
  }
  return '';
}

async function readLimited(response, limit = 512_000) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = '';
  while (total < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    output += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return output;
}

export async function fetchPageMetadata(address) {
  const url = new URL(address);
  if (process.env.NODE_ENV === 'test') {
    if (url.hostname === 'metadata-failure.test') throw new Error('Simulated metadata failure');
    if (url.hostname === 'new-bookmark.test') {
      return { title: 'A freshly fetched bookmark', description: 'Fetched page details for an acceptance test.', site: 'New Bookmark', icon: '' };
    }
  }

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(5000),
    headers: { 'user-agent': 'KeepBookmarks/1.0 (+personal bookmark metadata fetcher)', accept: 'text/html,application/xhtml+xml' }
  });
  if (!response.ok) throw new Error(`Page returned ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('Page is not HTML');
  const html = await readLimited(response);
  const title = metaContent(html, ['og:title', 'twitter:title']) || cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
  const site = metaContent(html, ['og:site_name']) || url.hostname.replace(/^www\./, '');
  const iconMatch = html.match(/<link[^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]*>/i);
  const icon = iconMatch ? new URL(iconMatch[1], response.url || url).href : new URL('/favicon.ico', response.url || url).href;
  return { title, description, site, icon };
}
