import fs from "node:fs";

const databaseFiles = ["/work/data/e2e.sqlite", "/work/data/e2e.sqlite-shm", "/work/data/e2e.sqlite-wal"];
for (const file of databaseFiles) fs.rmSync(file, { force: true });
console.log("Reset the isolated E2E database.");
