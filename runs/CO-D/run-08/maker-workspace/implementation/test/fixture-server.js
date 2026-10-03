import http from 'node:http';

http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><html><head><title>JavaScript | Test Docs</title><meta name="description" content="Guides and references for the JavaScript language."></head><body><article><h1>JavaScript</h1><p>JavaScript is a programming language used to make pages interactive.</p><h2>Closures</h2><p>A closure combines a function with its surrounding state.</p></article></body></html>`);
}).listen(4500, '0.0.0.0', () => console.log('fixture listening on 4500'));
