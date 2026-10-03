function absolute(value, base) { if (!value) return ''; try { return new URL(value, base).toString(); } catch { return ''; } }
function decode(value='') { return value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim(); }
function meta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) { const match=html.match(pattern); if(match) return decode(match[1]); }
  return '';
}

export async function fetchMetadata(rawUrl, fetcher=fetch) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetcher(rawUrl, { redirect:'follow', signal:controller.signal, headers:{ 'user-agent':'Mozilla/5.0 Keepsake Bookmark App' } });
    if (!response.ok) throw new Error(`Page responded with ${response.status}`);
    const type=response.headers.get('content-type') || '';
    if(!type.includes('text/html')) throw new Error('Page did not return HTML');
    const html=(await response.text()).slice(0, 1_500_000);
    const finalUrl=response.url || rawUrl;
    const title=meta(html,'og:title') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const description=meta(html,'og:description') || meta(html,'description');
    const thumbnail=absolute(meta(html,'og:image'), finalUrl);
    const iconMatch=html.match(/<link[^>]+rel=["'][^"']*(?:icon)[^"']*["'][^>]+href=["']([^"']+)["']/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon)[^"']*["']/i);
    return { url:rawUrl, title:title || new URL(rawUrl).hostname, description, thumbnail, favicon:iconMatch?absolute(iconMatch[1], finalUrl):'', siteName:new URL(rawUrl).hostname.replace(/^www\./,'') };
  } finally { clearTimeout(timer); }
}
