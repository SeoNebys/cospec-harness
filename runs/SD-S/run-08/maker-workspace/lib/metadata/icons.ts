import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fetchBounded, type MetadataFetcherOptions } from "./fetcher";

const ICON_LIMIT = 256 * 1024;
const TOKEN_TTL_MS = 15 * 60_000;
const tokens = new Map<string, { asset: string; expiresAt: number }>();

export async function retrieveIcon(url: string, options?: MetadataFetcherOptions, iconDir = path.join(process.cwd(), "data/icons")): Promise<string | null> {
  try {
    const fetched = await fetchBounded(url, { ...options, limits: { ...options?.limits, maxCompressedBytes: ICON_LIMIT, maxDecompressedBytes: ICON_LIMIT } }, "icon");
    if (fetched.contentType.includes("svg") || fetched.body.length > ICON_LIMIT) return null;
    const metadata = await sharp(fetched.body, { failOn: "error", limitInputPixels: 16_777_216 }).metadata();
    if (!["png", "jpeg", "gif", "webp", "ico"].includes(metadata.format ?? "")) return null;
    const png = await sharp(fetched.body, { failOn: "error" }).resize(64, 64, { fit: "contain", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
    const asset = `${createHash("sha256").update(png).digest("hex")}.png`;
    await mkdir(iconDir, { recursive: true });
    const temporary = path.join(iconDir, `.${asset}.${randomBytes(6).toString("hex")}.tmp`);
    await writeFile(temporary, png, { flag: "wx" });
    await rename(temporary, path.join(iconDir, asset)).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    const token = randomBytes(24).toString("base64url");
    tokens.set(token, { asset, expiresAt: Date.now() + TOKEN_TTL_MS });
    return token;
  } catch { return null; }
}

export function redeemIconToken(token: string): string | null {
  if (!/^[A-Za-z0-9_-]{32}$/u.test(token)) return null;
  const entry = tokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) { tokens.delete(token); return null; }
  return entry.asset;
}

export async function readIconAsset(asset: string, iconDir = path.join(process.cwd(), "data/icons")): Promise<Buffer | null> {
  if (!/^[a-f0-9]{64}\.png$/u.test(asset)) return null;
  try { return await readFile(path.join(iconDir, asset)); } catch { return null; }
}
