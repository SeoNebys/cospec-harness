export type ValidIcon = { mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/x-icon"; bytes: Buffer };

export function validateIcon(bytes: Buffer): ValidIcon | null {
  if (bytes.length < 4 || bytes.length > 262_144) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mediaType: "image/png", bytes };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) return { mediaType: "image/jpeg", bytes };
  const head = bytes.subarray(0, 6).toString("ascii");
  if (head === "GIF87a" || head === "GIF89a") return { mediaType: "image/gif", bytes };
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return { mediaType: "image/webp", bytes };
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return { mediaType: "image/x-icon", bytes };
  return null;
}
