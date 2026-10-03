import crypto from "node:crypto";
import type { MetadataStatus, TitleSource } from "../../shared/contracts/bookmarks.js";

export type ReceiptPayload = {
  userId: string;
  normalizedUrl: string;
  title: string;
  titleSource: Extract<TitleSource, "page" | "fallback">;
  status: MetadataStatus;
  failureCode: string | null;
  iconAssetId: number | null;
  finalUrl: string | null;
  expiresAt: number;
};

export function signReceipt(payload: ReceiptPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifyReceipt(token: string, secret: string): ReceiptPayload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(data).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as ReceiptPayload;
  return payload.expiresAt >= Date.now() ? payload : null;
}
