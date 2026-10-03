import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth, handleAuthRequest } from "~/auth/auth.server";
import { createTestAuth, signInCookie, testUsers } from "../helpers/auth";
import { createTestDatabase } from "../helpers/database";

describe("database-backed authentication", () => {
  let database: ReturnType<typeof createTestDatabase>;

  beforeEach(() => { database = createTestDatabase(); });
  afterEach(() => database.cleanup());

  it("disables runtime signup", async () => {
    const auth = createAuth(database.db, false);
    const response = await auth.handler(new Request("http://localhost:4000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:4000" },
      body: JSON.stringify(testUsers.alice),
    }));
    expect(response.status).toBe(400);
  });

  it("signs in, resolves, and revokes an opaque session", async () => {
    const auth = await createTestAuth(database.db);
    const cookie = await signInCookie(auth, testUsers.alice.email, testUsers.alice.password);
    expect(cookie).toMatch(/^bookmark\.session_token=/);

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.email).toBe(testUsers.alice.email);

    const signOut = await auth.handler(new Request("http://localhost:4000/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:4000" },
    }));
    expect(signOut.ok).toBe(true);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });

  it("rejects a credentialed request from an untrusted origin", async () => {
    const auth = await createTestAuth(database.db);
    void auth;
    const response = await handleAuthRequest(new Request("http://localhost:4000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.invalid" },
      body: JSON.stringify({ email: testUsers.alice.email, password: testUsers.alice.password }),
    }));
    expect(response.status).toBe(403);
  });
});
