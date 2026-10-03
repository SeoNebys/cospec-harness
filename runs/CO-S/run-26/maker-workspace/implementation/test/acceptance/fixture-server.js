// Offline fixture web server for acceptance tests. Serves a handful of pages
// so the app's real metadata fetch has deterministic, network-free targets.
import http from "node:http";

const PAGES = {
  "/react": {
    html: `<html><head><title>Introducing Hooks - React</title>
      <meta name="description" content="Use state and other React features without writing a class."></head></html>`,
  },
  "/nasa": {
    html: `<html><head><title>Artemis II - NASA</title>
      <meta name="description" content="The first crewed mission of NASA's Artemis campaign around the Moon."></head></html>`,
  },
  "/chicken": {
    html: `<html><head><title>The Food Lab: Perfect Roast Chicken</title>
      <meta name="description" content="The science behind an evenly cooked, crisp-skinned roast chicken."></head></html>`,
  },
  "/wiki": {
    html: `<html><head><title>Bookmark - Wikipedia</title>
      <meta name="description" content="A saved reference to a web page."></head></html>`,
  },
};

const server = http.createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (path === "/broken") {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("error");
    return;
  }
  const page = PAGES[path];
  if (!page) {
    res.writeHead(404, { "content-type": "text/html" });
    res.end("<title>Not found</title>");
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page.html);
});

const PORT = process.env.FIXTURE_PORT ? Number(process.env.FIXTURE_PORT) : 4100;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`fixture server on http://127.0.0.1:${PORT}`);
});
