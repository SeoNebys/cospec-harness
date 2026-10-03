import { createHash } from "node:crypto";
import sharp from "sharp";

const ACTIVE_CONTENT_TYPES = new Set([
  "image/svg+xml",
  "application/svg+xml",
  "application/xml",
  "text/xml",
  "text/html",
  "application/xhtml+xml",
]);

export type IconProcessingErrorCode =
  | "empty_input"
  | "input_too_large"
  | "active_content"
  | "unsupported_format"
  | "decode_failed"
  | "dimensions_exceeded";

export class IconProcessingError extends Error {
  constructor(
    public readonly code: IconProcessingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "IconProcessingError";
  }
}

export interface ProcessIconOptions {
  contentType?: string | null;
  maxInputBytes?: number;
  maxInputPixels?: number;
  maxOutputDimension?: number;
}

export interface ProcessedIcon {
  contentHash: string;
  pngBytes: Buffer;
  width: number;
  height: number;
  byteLength: number;
  mimeType: "image/png";
}

type RasterSignature = "png" | "jpeg" | "gif" | "webp" | "ico";

function hasPrefix(input: Buffer, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => input[index] === byte);
}

export function detectRasterSignature(input: Uint8Array): RasterSignature | null {
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.length >= 8 && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  if (bytes.length >= 3 && hasPrefix(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (
    bytes.length >= 6 &&
    (bytes.subarray(0, 6).toString("ascii") === "GIF87a" ||
      bytes.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (bytes.length >= 6 && hasPrefix(bytes, [0x00, 0x00, 0x01, 0x00])) return "ico";
  return null;
}

function normalizedContentType(value: string | null | undefined): string {
  return value?.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US") ?? "";
}

export async function processIcon(
  input: Uint8Array,
  options: ProcessIconOptions = {},
): Promise<ProcessedIcon> {
  const maxInputBytes = options.maxInputBytes ?? 256 * 1_024;
  const maxInputPixels = options.maxInputPixels ?? 1_000_000;
  const maxOutputDimension = options.maxOutputDimension ?? 64;
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);

  if (bytes.byteLength === 0) {
    throw new IconProcessingError("empty_input", "Icon response was empty");
  }
  if (bytes.byteLength > maxInputBytes) {
    throw new IconProcessingError("input_too_large", "Icon exceeded the byte limit");
  }
  if (ACTIVE_CONTENT_TYPES.has(normalizedContentType(options.contentType))) {
    throw new IconProcessingError("active_content", "Active icon content is not accepted");
  }
  if (!detectRasterSignature(bytes)) {
    throw new IconProcessingError(
      "unsupported_format",
      "Icon did not have a supported raster signature",
    );
  }

  try {
    const decoder = sharp(bytes, {
      animated: false,
      failOn: "error",
      limitInputPixels: maxInputPixels,
    });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height) {
      throw new IconProcessingError("decode_failed", "Icon dimensions were unavailable");
    }
    if (metadata.width * metadata.height > maxInputPixels) {
      throw new IconProcessingError("dimensions_exceeded", "Decoded icon exceeded the pixel limit");
    }

    const pngBytes = await decoder
      .rotate()
      .resize({
        width: maxOutputDimension,
        height: maxOutputDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, adaptiveFiltering: false, force: true })
      .toBuffer();
    const output = await sharp(pngBytes).metadata();
    if (!output.width || !output.height) {
      throw new IconProcessingError("decode_failed", "Re-encoded icon dimensions were unavailable");
    }

    return {
      contentHash: createHash("sha256").update(pngBytes).digest("hex"),
      pngBytes,
      width: output.width,
      height: output.height,
      byteLength: pngBytes.byteLength,
      mimeType: "image/png",
    };
  } catch (error) {
    if (error instanceof IconProcessingError) throw error;
    throw new IconProcessingError("decode_failed", "Icon could not be safely decoded", {
      cause: error,
    });
  }
}

export async function processIconOrNull(
  input: Uint8Array,
  options: ProcessIconOptions = {},
): Promise<ProcessedIcon | null> {
  try {
    return await processIcon(input, options);
  } catch (error) {
    if (error instanceof IconProcessingError) return null;
    throw error;
  }
}
