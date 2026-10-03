const path = require("path");
module.exports = {
  testDir: "./test/acceptance",
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4102", headless: true },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:4102/api/state",
    reuseExistingServer: false,
    timeout: 20000,
    env: { PORT: "4102", BM_DATA_DIR: path.join(__dirname, ".tmp-acceptance") },
  },
};
