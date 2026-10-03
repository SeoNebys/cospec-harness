import path from "node:path";

const positive = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  dataDir: path.resolve(/* turbopackIgnore: true */ process.env.BOOKMARK_DATA_DIR || path.join(process.cwd(), "data")),
  metadataTimeoutMs: positive(process.env.METADATA_TIMEOUT_MS, 8000),
  metadataMaxBytes: positive(process.env.METADATA_MAX_BYTES, 1024 * 1024),
  metadataConcurrency: positive(process.env.METADATA_MAX_CONCURRENCY, 2)
};
