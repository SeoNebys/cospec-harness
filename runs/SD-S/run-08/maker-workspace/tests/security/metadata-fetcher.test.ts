import assert from "node:assert/strict";
import test from "node:test";
import { MockAgent } from "undici";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { fetchBounded } from "../../lib/metadata/fetcher.js";
import { redeemIconToken, retrieveIcon } from "../../lib/metadata/icons.js";
import { isGloballyRoutable, resolvePublicTarget, validateMetadataUrl } from "../../lib/metadata/network-policy.js";

const forbidden = [
  "0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1",
  "192.168.1.1", "224.0.0.1", "255.255.255.255", "::", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "ff02::1",
];

test("rejects private and special IPv4/IPv6 forms", () => {
  for (const address of forbidden) assert.equal(isGloballyRoutable(address), false, address);
  assert.equal(isGloballyRoutable("8.8.8.8"), true);
  assert.equal(isGloballyRoutable("2606:4700:4700::1111"), true);
});

test("URL parsing rejects alternate private IPv4 spellings, credentials, schemes, and ports", () => {
  for (const input of ["http://2130706433", "http://0177.0.0.1", "http://0x7f000001"]) {
    const parsed = validateMetadataUrl(input);
    assert.equal(isGloballyRoutable(parsed.hostname), false, input);
  }
  for (const input of ["file:///etc/passwd", "http://user:pass@example.com", "https://example.com:8443"]) {
    assert.throws(() => validateMetadataUrl(input));
  }
});

test("rejects a DNS result set when any answer is non-public", async () => {
  await assert.rejects(resolvePublicTarget("https://example.test", async () => [
    { address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 },
  ]));
});

function mockOptions(agent: MockAgent) {
  return { resolver: async () => [{ address: "8.8.8.8", family: 4 }], dispatcherFactory: () => agent };
}

test("revalidates every redirect and blocks redirects to protected addresses", async () => {
  const agent = new MockAgent(); agent.disableNetConnect();
  agent.get("https://public.test").intercept({ path: "/", method: "GET" }).reply(302, "", { headers: { location: "http://127.0.0.1/secret" } });
  await assert.rejects(fetchBounded("https://public.test", mockOptions(agent)));
  await agent.close();
});

test("bounds redirect loops", async () => {
  const agent = new MockAgent(); agent.disableNetConnect();
  const pool = agent.get("https://public.test");
  for (let index = 0; index < 3; index++) pool.intercept({ path: "/", method: "GET" }).reply(302, "", { headers: { location: "/" } });
  await assert.rejects(fetchBounded("https://public.test", { ...mockOptions(agent), limits: { maxRedirects: 2 } }));
  await agent.close();
});

test("rejects non-HTML and compressed or decompressed bodies over their limits with sanitized errors", async () => {
  const agent = new MockAgent(); agent.disableNetConnect();
  const pool = agent.get("https://public.test");
  pool.intercept({ path: "/json", method: "GET" }).reply(200, "secret diagnostic", { headers: { "content-type": "application/json" } });
  pool.intercept({ path: "/large", method: "GET" }).reply(200, "x".repeat(100), { headers: { "content-type": "text/html" } });
  for (const [path, limits] of [["/json", {}], ["/large", { maxCompressedBytes: 10 }]] as const) {
    await assert.rejects(fetchBounded(`https://public.test${path}`, { ...mockOptions(agent), limits }), (error: Error) => {
      assert.equal(error.message, "Page metadata is unavailable.");
      assert.equal(error.message.includes("secret"), false);
      return true;
    });
  }
  await agent.close();
});

test("aborts a slow response at the total deadline", async () => {
  const agent = new MockAgent(); agent.disableNetConnect();
  agent.get("https://public.test").intercept({ path: "/slow", method: "GET" }).reply(200, async () => {
    await new Promise((resolve) => setTimeout(resolve, 80)); return "<title>late</title>";
  }, { headers: { "content-type": "text/html" } });
  await assert.rejects(fetchBounded("https://public.test/slow", { ...mockOptions(agent), limits: { timeoutMs: 10 } }));
  await agent.close();
});

test("rejects SVG and invalid icons, but normalizes raster icons into opaque cache tokens", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bookmark-icons-"));
  const raster = await sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } }).png().toBuffer();
  const agent = new MockAgent(); agent.disableNetConnect();
  const pool = agent.get("https://public.test");
  pool.intercept({ path: "/svg", method: "GET" }).reply(200, "<svg/>", { headers: { "content-type": "image/svg+xml" } });
  pool.intercept({ path: "/invalid", method: "GET" }).reply(200, "not an image", { headers: { "content-type": "image/png" } });
  pool.intercept({ path: "/raster", method: "GET" }).reply(200, raster, { headers: { "content-type": "image/png" } });
  assert.equal(await retrieveIcon("https://public.test/svg", mockOptions(agent), directory), null);
  assert.equal(await retrieveIcon("https://public.test/invalid", mockOptions(agent), directory), null);
  const token = await retrieveIcon("https://public.test/raster", mockOptions(agent), directory);
  assert.match(token ?? "", /^[A-Za-z0-9_-]{32}$/u);
  assert.match(redeemIconToken(token!) ?? "", /^[a-f0-9]{64}\.png$/u);
  await agent.close();
});
