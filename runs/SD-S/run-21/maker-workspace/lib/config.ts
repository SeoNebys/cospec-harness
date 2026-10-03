import path from "node:path";

export const config = {
  dbPath:
    process.env.BOOKMARK_DB_PATH ||
    path.join(process.cwd(), "data", "kept.sqlite"),
  metadataTimeoutMs: Number(process.env.METADATA_TIMEOUT_MS || 8000),
  metadataMaxBytes: Number(process.env.METADATA_MAX_BYTES || 2 * 1024 * 1024)
};
