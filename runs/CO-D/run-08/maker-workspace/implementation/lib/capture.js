import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';

function absolutize($, base) {
  for (const [selector, attribute] of [['a','href'],['img','src']]) {
    $(selector).each((_, element) => {
      const value = $(element).attr(attribute);
      if (!value) return;
      try { $(element).attr(attribute, new URL(value, base).href); } catch {}
    });
  }
}

export async function capturePage(url, fetcher = fetch) {
  const response = await fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'LinkHome/1.0 personal bookmark archiver' } });
  if (!response.ok) throw new Error(`Page responded with ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) throw new Error('Page is not readable HTML');
  const html = await response.text();
  const $ = cheerio.load(html);
  const title = ($('meta[property="og:title"]').attr('content') || $('title').text() || '').trim();
  const description = ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '').trim();
  $('script,style,noscript,iframe,object,embed,form,nav').remove();
  absolutize($, response.url || url);
  const candidate = $('article').first().length ? $('article').first().html() : ($('main').first().html() || $('body').html());
  const snapshot = sanitizeHtml(candidate || '', {
    allowedTags: ['article','section','header','footer','h1','h2','h3','h4','p','br','ul','ol','li','blockquote','pre','code','strong','em','b','i','a','img','figure','figcaption','table','thead','tbody','tr','th','td'],
    allowedAttributes: { a: ['href'], img: ['src','alt','title'], '*': ['title'] },
    allowedSchemes: ['http','https','data']
  });
  return { title, description, snapshot: snapshot.replace(/<[^>]+>/g, '').trim() ? snapshot : '' };
}
