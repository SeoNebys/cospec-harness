"use strict";
// Entry point: wires the real store + network fetcher and listens on 0.0.0.0:4000.

const path = require("path");
const { Store } = require("./store.js");
const { createFetcher } = require("./fetcher.js");
const { createService } = require("./service.js");
const { createApp } = require("./app.js");

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

const store = new Store(DATA_DIR);
const fetcher = createFetcher(); // uses global fetch
const service = createService(store, fetcher);
const app = createApp(service);

app.listen(PORT, HOST, () => {
  console.log(`Link Library listening on http://${HOST}:${PORT}`);
});
