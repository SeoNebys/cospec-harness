import { createAuth } from "~/auth/auth.server";
import type { AppDatabase } from "~/db/client.server";

export const testUsers = {
  alice: { name: "Alice Rivera", email: "alice@example.test", password: "Bookmarks-Alice-2026!" },
  bob: { name: "Bob Chen", email: "bob@example.test", password: "Bookmarks-Bob-2026!" },
};

export async function createTestAuth(database: AppDatabase) {
  const seedAuth = createAuth(database, true);
  for (const user of Object.values(testUsers)) await seedAuth.api.signUpEmail({ body: user });
  return createAuth(database, false);
}

export async function signInCookie(auth: ReturnType<typeof createAuth>, email: string, password: string) {
  const response = await auth.handler(new Request("http://localhost:4000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:4000" },
    body: JSON.stringify({ email, password }),
  }));
  const cookie = response.headers.get("set-cookie");
  if (!response.ok || !cookie) throw new Error(`Unable to sign in test user (${response.status})`);
  return cookie.split(";", 1)[0] ?? cookie;
}
