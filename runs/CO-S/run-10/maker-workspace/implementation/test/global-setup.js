import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Start each e2e run from an empty data file.
export default function globalSetup() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  rmSync(join(__dirname, ".e2e-data.json"), { force: true });
}
