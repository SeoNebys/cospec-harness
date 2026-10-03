import { cookies } from "next/headers";
import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, ensureDatabase } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";

const COOKIE = "bookmark_session";
const SESSION_DAYS = 7;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const secret = process.env.BETTER_AUTH_SECRET || "review-only-local-secret-change-in-production";
const sign = (value: string) => createHmac("sha256", secret).update(value).digest("base64url");

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId: string) {
  await ensureDatabase();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Cannot create a session for a missing user.");
  const payload = Buffer.from(JSON.stringify({ ...user, exp: expiresAt.getTime() })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  await db.insert(sessions).values({ id: randomUUID(), tokenHash: hashToken(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.AUTH_SECURE_COOKIES === "true", sameSite: "lax", path: "/", expires: expiresAt });
}

export async function destroySession() {
  await ensureDatabase();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString()) as { id: string; name: string; email: string; exp: number };
    if (!user.id || !user.email || user.exp <= Date.now()) return null;
    return { id: user.id, name: user.name, email: user.email };
  } catch { return null; }
}
