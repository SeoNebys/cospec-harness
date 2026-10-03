export interface Env {
  databasePath: string;
  host: string;
  port: number;
  cookieSecure: boolean;
  sessionHours: number;
  uploadBytes: number;
  metadataTimeoutMs: number;
  metadataHtmlBytes: number;
  metadataIconBytes: number;
  metadataTestFixtures: boolean;
  reviewEmail?: string;
  reviewPassword?: string;
}

const number = (value: string | undefined, fallback: number) => {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(result) || result <= 0) throw new Error(`Invalid positive number: ${value}`);
  return result;
};

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result: Env = {
    databasePath: source.DATABASE_PATH ?? 'data/bookmarks.sqlite',
    host: source.HOST ?? '0.0.0.0',
    port: number(source.PORT, 4000),
    cookieSecure: source.COOKIE_SECURE === 'true',
    sessionHours: number(source.SESSION_HOURS, 24 * 30),
    uploadBytes: number(source.UPLOAD_BYTES, 10 * 1024 * 1024),
    metadataTimeoutMs: number(source.METADATA_TIMEOUT_MS, 5_000),
    metadataHtmlBytes: number(source.METADATA_HTML_BYTES, 1024 * 1024),
    metadataIconBytes: number(source.METADATA_ICON_BYTES, 256 * 1024),
    metadataTestFixtures: source.METADATA_TEST_FIXTURES === 'true',
  };
  if (source.REVIEW_EMAIL) result.reviewEmail = source.REVIEW_EMAIL;
  if (source.REVIEW_PASSWORD) result.reviewPassword = source.REVIEW_PASSWORD;
  return result;
}
