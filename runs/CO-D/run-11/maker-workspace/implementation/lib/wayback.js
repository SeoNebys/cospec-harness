// Submit a URL to the Internet Archive (Wayback Machine) Save Page Now.
'use strict';
var fetcher = require('./fetcher');

// Returns { url, date } of the archived capture, or throws on failure.
async function preserve(pageUrl) {
  var saveUrl = 'https://web.archive.org/save/' + pageUrl;
  var res = await fetcher.fetchWithTimeout(saveUrl, { method: 'GET' }, 30000);
  // The archive returns the capture location in a header (or the final URL).
  var loc = res.headers.get('content-location') || res.headers.get('location');
  var archivedUrl;
  if (loc && loc.indexOf('/web/') === 0) archivedUrl = 'https://web.archive.org' + loc;
  else if (res.url && res.url.indexOf('web.archive.org/web/') >= 0) archivedUrl = res.url;
  else {
    // Fall back to a timestamped wayback URL that will resolve to the latest capture.
    var ts = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    archivedUrl = 'https://web.archive.org/web/' + ts + '/' + pageUrl;
  }
  if (!res.ok && !archivedUrl) throw new Error('Internet Archive request failed (status ' + res.status + ').');
  return { url: archivedUrl, date: Date.now() };
}

module.exports = { preserve: preserve };
