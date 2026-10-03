/* Standalone fixture site for acceptance tests: deterministic pages with
   OG metadata, an image, a PDF, a failing route, and an Internet-Archive
   /save/ stub. Usage: PORT=nnnn node test/fixture-server.js */
'use strict';
const http = require('http');
const PORT = parseInt(process.env.PORT || '4200', 10);
const PNG = Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001080600000' +
  '01f15c4890000000d49444154789c62f8cf00000000ffff0300000600055773d7b30000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF', 'utf8');

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (p === '/page' || p === '/page2' || p === '/page3' || p === '/page4' || p === '/page5') {
    const n = p.slice(5) || '1';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>Fallback ' + n + '</title>' +
      '<meta property="og:title" content="Sample Page ' + n + '">' +
      '<meta property="og:description" content="Description for sample page ' + n + ' with enough words to read.">' +
      '<meta property="og:site_name" content="Fixture ' + n + '">' +
      '<meta property="og:image" content="/img.png">' +
      '<link rel="icon" href="/fav.ico"></head><body><h1>Sample ' + n + '</h1><img src="/img.png"></body></html>');
  } else if (p === '/fail') { res.writeHead(500); res.end('boom'); }
  else if (p === '/doc.pdf') { res.writeHead(200, { 'content-type': 'application/pdf' }); res.end(PDF); }
  else if (p === '/img.png' || p === '/fav.ico') { res.writeHead(200, { 'content-type': p.endsWith('png') ? 'image/png' : 'image/x-icon' }); res.end(PNG); }
  else if (p.startsWith('/save/')) { res.writeHead(200); res.end('ok'); }
  else { res.writeHead(404); res.end('nf'); }
}).listen(PORT, '127.0.0.1', () => console.log('fixture on ' + PORT));
