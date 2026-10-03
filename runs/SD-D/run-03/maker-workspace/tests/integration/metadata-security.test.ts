import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

import {
  classifyIpAddress,
  type ResolvedAddress,
} from "../../src/server/services/metadata/ip-policy.js";
import {
  type DnsResolver,
  type SafeFetchTransport,
  SafeMetadataFetchError,
  safeFetch,
} from "../../src/server/services/metadata/safe-fetch.js";

function resolverFor(answers: Readonly<Record<string, readonly ResolvedAddress[]>>): DnsResolver {
  return {
    async resolve(hostname) {
      return answers[hostname] ?? [];
    },
  };
}

function response(
  body: string | Buffer,
  options: {
    statusCode?: number;
    headers?: Readonly<Record<string, string>>;
  } = {},
) {
  return {
    statusCode: options.statusCode ?? 200,
    headers: options.headers ?? { "content-type": "text/html; charset=utf-8" },
    body: Readable.from([typeof body === "string" ? Buffer.from(body) : body]),
  };
}

describe("metadata destination IP policy", () => {
  it.each([
    ["93.184.216.34", "public"],
    ["8.8.8.8", "public"],
    ["0.0.0.0", "unspecified"],
    ["127.0.0.1", "loopback"],
    ["10.1.2.3", "private"],
    ["172.16.0.1", "private"],
    ["192.168.1.2", "private"],
    ["100.64.0.1", "carrier-grade-nat"],
    ["169.254.169.254", "link-local"],
    ["224.0.0.1", "multicast"],
    ["192.0.2.10", "reserved"],
    ["2606:4700:4700::1111", "public"],
    ["::", "unspecified"],
    ["::1", "loopback"],
    ["fe80::1", "link-local"],
    ["fc00::1", "private"],
    ["ff02::1", "multicast"],
    ["2001:db8::1", "reserved"],
    ["::ffff:127.0.0.1", "loopback"],
    ["not-an-ip", "invalid"],
  ])("classifies %s as %s", (address, expected) => {
    expect(classifyIpAddress(address)).toBe(expected);
  });
});

describe("safe metadata fetch", () => {
  it("rejects a hostname when any DNS answer is non-public", async () => {
    const transport = { request: vi.fn() } satisfies SafeFetchTransport;

    await expect(
      safeFetch("https://mixed.test/page", {
        resolver: resolverFor({
          "mixed.test": [
            { address: "93.184.216.34", family: 4 },
            { address: "127.0.0.1", family: 4 },
          ],
        }),
        transport,
      }),
    ).rejects.toMatchObject({ code: "DENIED_DESTINATION" });
    expect(transport.request).not.toHaveBeenCalled();
  });

  it("pins the connection to the complete set of validated DNS answers", async () => {
    const addresses = [
      { address: "93.184.216.34", family: 4 as const },
      { address: "2606:4700:4700::1111", family: 6 as const },
    ];
    const request = vi.fn(async () => response("<title>Safe</title>"));

    await safeFetch("https://public.test/page", {
      resolver: resolverFor({ "public.test": addresses }),
      transport: { request },
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      url: new URL("https://public.test/page"),
      addresses,
    });
  });

  it("revalidates and pins every redirect destination", async () => {
    const request = vi
      .fn<SafeFetchTransport["request"]>()
      .mockResolvedValueOnce(
        response("", {
          statusCode: 302,
          headers: { location: "https://redirected.test/final" },
        }),
      )
      .mockResolvedValueOnce(response("done"));

    const result = await safeFetch("https://initial.test/start", {
      resolver: resolverFor({
        "initial.test": [{ address: "93.184.216.34", family: 4 }],
        "redirected.test": [{ address: "8.8.8.8", family: 4 }],
      }),
      transport: { request },
    });

    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: new URL("https://redirected.test/final"),
        addresses: [{ address: "8.8.8.8", family: 4 }],
      }),
    );
    expect(result.finalUrl.href).toBe("https://redirected.test/final");
  });

  it("blocks a redirect to a private address before a second connection", async () => {
    const request = vi.fn<SafeFetchTransport["request"]>().mockResolvedValueOnce(
      response("", {
        statusCode: 301,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    await expect(
      safeFetch("https://initial.test/start", {
        resolver: resolverFor({
          "initial.test": [{ address: "93.184.216.34", family: 4 }],
        }),
        transport: { request },
      }),
    ).rejects.toMatchObject({ code: "DENIED_DESTINATION" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("enforces the redirect limit", async () => {
    const request = vi.fn(async ({ url }) =>
      response("", {
        statusCode: 302,
        headers: { location: new URL(`/next-${url.pathname.length}`, url).href },
      }),
    );

    await expect(
      safeFetch("https://public.test/start", {
        resolver: resolverFor({
          "public.test": [{ address: "93.184.216.34", family: 4 }],
        }),
        transport: { request },
        maxRedirects: 1,
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported document media types", async () => {
    await expect(
      safeFetch("https://public.test/file.pdf", {
        resolver: resolverFor({
          "public.test": [{ address: "93.184.216.34", family: 4 }],
        }),
        transport: {
          async request() {
            return response("%PDF", { headers: { "content-type": "application/pdf" } });
          },
        },
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT_TYPE" });
  });

  it("rejects active icon types while accepting declared raster types", async () => {
    const resolver = resolverFor({
      "public.test": [{ address: "93.184.216.34", family: 4 }],
    });

    await expect(
      safeFetch("https://public.test/icon.svg", {
        resolver,
        acceptedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/x-icon"],
        transport: {
          async request() {
            return response("<svg/>", { headers: { "content-type": "image/svg+xml" } });
          },
        },
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT_TYPE" });

    const png = await safeFetch("https://public.test/icon.png", {
      resolver,
      acceptedContentTypes: ["image/png"],
      transport: {
        async request() {
          return response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
            headers: { "content-type": "image/png" },
          });
        },
      },
    });
    expect(png.body).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("applies byte limits after decompression", async () => {
    const compressed = gzipSync(Buffer.alloc(2_000, "a"));

    await expect(
      safeFetch("https://public.test/compressed", {
        resolver: resolverFor({
          "public.test": [{ address: "93.184.216.34", family: 4 }],
        }),
        maxBytes: 1_000,
        transport: {
          async request() {
            return response(compressed, {
              headers: { "content-encoding": "gzip", "content-type": "text/html" },
            });
          },
        },
      }),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("enforces a single overall deadline across DNS and transport", async () => {
    const request = vi.fn(
      () =>
        new Promise<never>(() => {
          // The fetcher's abort deadline must settle this otherwise-pending transport.
        }),
    );

    await expect(
      safeFetch("https://public.test/slow", {
        resolver: resolverFor({
          "public.test": [{ address: "93.184.216.34", family: 4 }],
        }),
        transport: { request },
        deadlineMs: 10,
      }),
    ).rejects.toBeInstanceOf(SafeMetadataFetchError);
    await expect(
      safeFetch("https://public.test/slow", {
        resolver: resolverFor({
          "public.test": [{ address: "93.184.216.34", family: 4 }],
        }),
        transport: { request },
        deadlineMs: 10,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("rejects credentials and non-HTTP protocols without resolving them", async () => {
    const resolve = vi.fn();
    const resolver = { resolve } satisfies DnsResolver;

    await expect(
      safeFetch("https://user:secret@public.test/page", { resolver }),
    ).rejects.toMatchObject({ code: "DENIED_DESTINATION" });
    await expect(safeFetch("file:///etc/passwd", { resolver })).rejects.toMatchObject({
      code: "UNSUPPORTED_PROTOCOL",
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("rejects custom ports, private literals, empty DNS answers, and malformed redirects", async () => {
    const request = vi.fn<SafeFetchTransport["request"]>();
    const resolve = vi.fn(async () => [] as ResolvedAddress[]);

    await expect(
      safeFetch("https://public.test:8443/page", { resolver: { resolve }, transport: { request } }),
    ).rejects.toMatchObject({ code: "DENIED_DESTINATION" });
    await expect(
      safeFetch("http://127.0.0.1/page", { resolver: { resolve }, transport: { request } }),
    ).rejects.toMatchObject({ code: "DENIED_DESTINATION" });
    await expect(
      safeFetch("https://empty.test/page", { resolver: { resolve }, transport: { request } }),
    ).rejects.toMatchObject({ code: "DENIED_DESTINATION" });

    const malformedRedirect = vi.fn(async () =>
      response("", { statusCode: 302, headers: { location: "https://[broken" } }),
    );
    await expect(
      safeFetch("https://public.test/page", {
        resolver: resolverFor({
          "public.test": [{ address: "93.184.216.34", family: 4 }],
        }),
        transport: { request: malformedRedirect },
      }),
    ).rejects.toMatchObject({ code: "INVALID_REDIRECT" });
    expect(request).not.toHaveBeenCalled();
  });

  it("sends only purpose-built metadata headers and preserves HTTPS for the pinned transport", async () => {
    const request = vi.fn(async () => response("<title>Safe TLS target</title>"));
    await safeFetch("https://public.test/page", {
      resolver: resolverFor({
        "public.test": [{ address: "93.184.216.34", family: 4 }],
      }),
      transport: { request },
    });

    const sent = request.mock.calls[0]?.[0];
    expect(sent?.url.protocol).toBe("https:");
    expect(sent?.headers).toMatchObject({
      accept: expect.stringContaining("text/html"),
      "accept-encoding": "gzip, deflate, br",
      "user-agent": "BookmarkGardenMetadata/1.0",
    });
    expect(sent?.headers).not.toHaveProperty("cookie");
    expect(sent?.headers).not.toHaveProperty("authorization");
    expect(sent?.addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
});
