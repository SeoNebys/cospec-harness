import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const METADATA_FIXTURE_ROOT = fileURLToPath(
  new URL("../fixtures/metadata/", import.meta.url),
);

export type MetadataHtmlFixture =
  | "complete.html"
  | "open-graph.html"
  | "base-url.html"
  | "whitespace.html"
  | "malformed.html.fixture"
  | "missing.html"
  | "unsafe-icon.html";

export type MetadataAssetFixture =
  | "icon-1x1.png.base64"
  | "active-icon.svg.fixture"
  | "not-an-icon.html";

export type MetadataFixture = MetadataHtmlFixture | MetadataAssetFixture;

export const METADATA_FIXTURE_URL = "https://metadata.test";
export const METADATA_FIXTURE_PUBLIC_IP = "93.184.216.34";

export function metadataFixturePath(name: MetadataFixture): string {
  return fileURLToPath(new URL(`../fixtures/metadata/${name}`, import.meta.url));
}

export function readMetadataFixture(name: MetadataFixture): string {
  return readFileSync(metadataFixturePath(name), "utf8");
}

export function readMetadataFixtureBytes(name: MetadataAssetFixture): Buffer {
  const contents = readMetadataFixture(name);
  return name.endsWith(".base64")
    ? Buffer.from(contents.replaceAll(/\s/g, ""), "base64")
    : Buffer.from(contents);
}

export interface MetadataFixtureResponse {
  statusCode: number;
  headers: Readonly<Record<string, string>>;
  body: Buffer;
}

export function htmlFixtureResponse(
  name: MetadataHtmlFixture,
  overrides: {
    statusCode?: number;
    headers?: Readonly<Record<string, string>>;
  } = {},
): MetadataFixtureResponse {
  return {
    statusCode: overrides.statusCode ?? 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...overrides.headers,
    },
    body: Buffer.from(readMetadataFixture(name)),
  };
}

export function assetFixtureResponse(
  name: MetadataAssetFixture,
  contentType: string,
): MetadataFixtureResponse {
  return {
    statusCode: 200,
    headers: { "content-type": contentType },
    body: readMetadataFixtureBytes(name),
  };
}
