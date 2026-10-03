import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createMetadataService } from "~/services/metadata/metadata.service.server";
import { createTestDatabase } from "../helpers/database";
import { createTestAuth, testUsers } from "../helpers/auth";

describe("adversarial metadata flow", () => {
  const servers: ReturnType<typeof createServer>[] = [];
  afterEach(() => { for (const server of servers.splice(0)) server.close(); });

  it("parses fixture markup inertly and never returns script content", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "text/html");
      response.end("<title>Safe title</title><meta name='description' content='Useful'><script>globalThis.pwned='yes'</script>");
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture failed");
    const database = createTestDatabase();
    await createTestAuth(database.db);
    const alice = await database.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, testUsers.alice.email) });
    const result = await createMetadataService(database.db, {
      allowTestPorts: true,
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
      allowAddress: () => true,
    }).preview(alice!.id, `http://fixture.test:${address.port}`, "r1");
    expect(result).toMatchObject({ title: "Safe title", description: "Useful", status: "retrieved" });
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
    database.cleanup();
  });
});
