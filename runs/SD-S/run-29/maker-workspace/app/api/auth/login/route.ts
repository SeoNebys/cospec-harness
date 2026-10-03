import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth/server";
import { db, ensureDatabase } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { privateJson, problem } from "@/lib/http/problem";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
export async function POST(request: Request) {
  await ensureDatabase();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  const source = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!allowAuthAttempt(`${source}:${parsed.data.email}`)) return problem(429, "TOO_MANY_ATTEMPTS", "Too many sign-in attempts. Please wait and try again.");
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) return problem(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  await createSession(user.id);
  return privateJson({ user: { id: user.id, name: user.name, email: user.email } });
}
