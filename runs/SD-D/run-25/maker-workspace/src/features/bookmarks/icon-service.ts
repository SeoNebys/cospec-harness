import "server-only";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getConfig } from "@/lib/config";
import { getSqlite } from "@/lib/db/client";
import { safeFetch } from "@/lib/http/safe-fetch";

const ALLOWED = /^(image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon)|application\/octet-stream)$/;

export async function cacheIcon(iconUrl: string | null): Promise<string | null> {
  if (!iconUrl) return null;
  try {
    const result = await safeFetch(iconUrl, { maxBytes: 256 * 1024, timeoutMs: 5000, allowedContentTypes: ALLOWED });
    const source = sharp(result.body, { animated: false, limitInputPixels: 512 * 512 });
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 512 || metadata.height > 512 || metadata.format === "svg") return null;
    const png = await source.resize(64, 64, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    const key = createHash("sha256").update(png).digest("hex");
    const directory = path.resolve(getConfig().ICON_DIRECTORY);
    await fs.mkdir(directory, { recursive: true });
    const storagePath = path.join(directory, `${key}.png`);
    await fs.writeFile(storagePath, png, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    getSqlite().prepare("INSERT OR IGNORE INTO icon_assets (key, storage_path, byte_length, created_at) VALUES (?, ?, ?, ?)").run(key, storagePath, png.length, Date.now());
    return key;
  } catch {
    return null;
  }
}

export async function readIcon(key: string | null, fallbackLetter = "S"): Promise<Buffer> {
  if (key) {
    const row = getSqlite().prepare("SELECT storage_path FROM icon_assets WHERE key = ?").get(key) as { storage_path: string } | undefined;
    if (row) {
      try { return await fs.readFile(row.storage_path); } catch { /* fall through */ }
    }
  }
  const letter = fallbackLetter.replaceAll(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "S";
  return sharp(Buffer.from(`<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#dce9df"/><text x="32" y="42" font-size="30" text-anchor="middle" font-family="Arial" fill="#285c46">${letter}</text></svg>`)).png().toBuffer();
}
