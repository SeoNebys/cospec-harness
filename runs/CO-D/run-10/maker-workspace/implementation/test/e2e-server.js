import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createKeepsakeServer } from "../server.js";

const directory = await mkdtemp(path.join(os.tmpdir(), "keepsake-e2e-"));
const metadataReader = async (url) => url.includes("unreadable.example")
  ? { available: false, url, siteName: "unreadable.example", title: "", description: "", favicon: "", previewImage: "" }
  : {
      available: true, url, siteName: new URL(url).hostname.replace(/^www\./, ""),
      title: "The page title gathered automatically",
      description: "A description gathered from the page for easy recognition.",
      favicon: "", previewImage: ""
    };
const { server } = await createKeepsakeServer({ dataFile: path.join(directory, "library.json"), metadataReader });
server.listen(4100, "127.0.0.1", () => console.log("e2e server ready"));

async function close() {
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
