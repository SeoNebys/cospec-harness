import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { initializeSchema } from "./schema";

let singleton: DatabaseSync | undefined;
export function getDb() {
  if (!singleton) {
    if (config.dbPath !== ":memory:")
      fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    singleton = new DatabaseSync(config.dbPath);
    initializeSchema(singleton);
  }
  return singleton;
}
export function createDb(filename = ":memory:") {
  const db = new DatabaseSync(filename);
  initializeSchema(db);
  return db;
}
