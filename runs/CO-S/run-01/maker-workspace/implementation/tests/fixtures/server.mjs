// Tiny fixtures server: serves sample link pages so the app's real details
// fetch works offline during acceptance tests.
import http from 'node:http';

const PAGES = {
  '/mdn': {
    title: 'Array.prototype.map() - JavaScript | MDN',
    desc: 'The map() method creates a new array.',
    site: 'MDN Web Docs'
  },
  '/flexbox': {
    title: 'A Complete Guide to Flexbox',
    desc: 'A visual guide to CSS flexbox.',
    site: 'CSS-Tricks'
  },
  '/cookies': {
    title: 'The Best Chocolate Chip Cookies Recipe',
    desc: 'A tested recipe for chewy cookies.',
    site: 'Serious Eats'
  }
};

const PORT = Number(process.env.FIXTURES_PORT) || 4020;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const page = PAGES[url.pathname];
  if (!page) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  const html = `<!DOCTYPE html><html><head>
    <title>${page.title}</title>
    <meta name="description" content="${page.desc}" />
    <meta property="og:site_name" content="${page.site}" />
    </head><body>ok</body></html>`;
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
}).listen(PORT, () => console.log('fixtures server on ' + PORT));
