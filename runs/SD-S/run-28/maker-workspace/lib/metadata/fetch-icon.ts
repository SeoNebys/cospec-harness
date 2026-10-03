import { createHash } from "node:crypto";
import { request, type Dispatcher } from "undici";

const allowed = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function fetchIcon(url: URL, dispatcher: Dispatcher, signal: AbortSignal) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  const response = await request(url, { dispatcher, signal, headers: { accept: "image/png,image/jpeg,image/gif,image/webp" } });
  const mediaType = String(response.headers["content-type"] ?? "").split(";")[0].toLowerCase();
  if (response.statusCode < 200 || response.statusCode >= 300 || !allowed.has(mediaType)) { response.body.destroy(); return undefined; }
  const chunks: Buffer[] = []; let total = 0;
  for await (const chunk of response.body) { const part = Buffer.from(chunk); total += part.length; if (total > 131072) { response.body.destroy(); return undefined; } chunks.push(part); }
  const content = Buffer.concat(chunks);
  if (!matchesSignature(content, mediaType)) return undefined;
  return { id: createHash("sha256").update(content).digest("hex"), mediaType: mediaType as "image/png"|"image/jpeg"|"image/gif"|"image/webp", content };
}

function matchesSignature(data: Buffer, type: string): boolean {
  if (type === "image/png") return data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8;
  if (type === "image/gif") return data.subarray(0, 3).toString() === "GIF";
  if (type === "image/webp") return data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP";
  return false;
}
