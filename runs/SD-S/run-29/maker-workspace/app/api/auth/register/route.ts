import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth/server";
import { db, ensureDatabase } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { privateJson, problem } from "@/lib/http/problem";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";

const schema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(128) });
export async function POST(request: Request) {
  await ensureDatabase();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "VALIDATION_FAILED", "Check your name, email, and password.", { fieldErrors: z.flattenError(parsed.error).fieldErrors });
  const source = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!allowAuthAttempt(`register:${source}`, 20)) return problem(429, "TOO_MANY_ATTEMPTS", "Too many account requests. Please wait and try again.");
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (exists.length) return problem(409, "ACCOUNT_EXISTS", "An account already uses that email address.");
  const id = randomUUID();
  await db.insert(users).values({ id, name: parsed.data.name, email: parsed.data.email, passwordHash: hashPassword(parsed.data.password) });
  await createSession(id);
  return privateJson({ user: { id, name: parsed.data.name, email: parsed.data.email } }, { status: 201 });
}
