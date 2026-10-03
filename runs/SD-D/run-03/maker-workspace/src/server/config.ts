import path from "node:path";

export interface AppConfig {
  host: string;
  port: number;
  databasePath: string;
  nodeEnv: "development" | "test" | "production";
  clientDirectory: string;
  metadata: {
    deadlineMs: number;
    connectTimeoutMs: number;
    maxHtmlBytes: number;
    maxIconBytes: number;
    maxRedirects: number;
    concurrency: number;
  };
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  const configuredDatabase = env.DATABASE_PATH ?? "data/bookmarks.sqlite";

  return {
    host: env.HOST || "0.0.0.0",
    port: positiveInteger(env.PORT, 4000, "PORT"),
    databasePath:
      configuredDatabase === ":memory:"
        ? configuredDatabase
        : path.resolve(cwd, configuredDatabase),
    nodeEnv,
    clientDirectory: path.resolve(cwd, env.CLIENT_DIRECTORY ?? "dist/client"),
    metadata: {
      deadlineMs: positiveInteger(env.METADATA_DEADLINE_MS, 5_000, "METADATA_DEADLINE_MS"),
      connectTimeoutMs: positiveInteger(
        env.METADATA_CONNECT_TIMEOUT_MS,
        2_000,
        "METADATA_CONNECT_TIMEOUT_MS",
      ),
      maxHtmlBytes: positiveInteger(
        env.METADATA_MAX_HTML_BYTES,
        1_048_576,
        "METADATA_MAX_HTML_BYTES",
      ),
      maxIconBytes: positiveInteger(
        env.METADATA_MAX_ICON_BYTES,
        262_144,
        "METADATA_MAX_ICON_BYTES",
      ),
      maxRedirects: positiveInteger(env.METADATA_MAX_REDIRECTS, 5, "METADATA_MAX_REDIRECTS"),
      concurrency: positiveInteger(env.METADATA_CONCURRENCY, 3, "METADATA_CONCURRENCY"),
    },
  };
}
