import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { config } from "~/config.server";
import { db, type AppDatabase } from "~/db/client.server";
import * as schema from "~/db/schema";

export function createAuth(database: AppDatabase, allowSignUp = false) {
  return betterAuth({
    appName: "Keepsake",
    baseURL: config.BETTER_AUTH_URL,
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      minPasswordLength: 10,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      cookiePrefix: "bookmark",
      useSecureCookies: config.NODE_ENV === "production",
      database: { generateId: "uuid" },
    },
  });
}

export const auth = createAuth(db);

export async function handleAuthRequest(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin && !config.trustedOrigins.includes(origin)) {
      return Response.json(
        { code: "UNTRUSTED_ORIGIN", message: "This request origin is not allowed." },
        { status: 403 },
      );
    }
  }
  return auth.handler(request);
}
