import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { fetchPage } from "~/services/metadata/fetch-page.server";

describe("bounded metadata fetch", () => {
  const servers: ReturnType<typeof createServer>[] = [];
  afterEach(() => { for (const server of servers.splice(0)) server.close(); });

  it("retrieves bounded HTML through an injected approved resolver", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end("<title>Fixture</title>");
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture did not start");
    const result = await fetchPage(new URL(`http://fixture.test:${address.port}`), {
      allowTestPorts: true,
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
      allowAddress: () => true,
    });
    expect(result.body.toString()).toContain("Fixture");
  });

  it("rejects non-HTML and oversized streams", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "application/octet-stream");
      response.end("binary");
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture did not start");
    await expect(fetchPage(new URL(`http://fixture.test:${address.port}`), {
      allowTestPorts: true,
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
      allowAddress: () => true,
    })).rejects.toThrow("non_html");
  });
});
