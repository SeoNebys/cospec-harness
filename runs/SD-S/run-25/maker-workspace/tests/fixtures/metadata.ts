export interface MetadataDnsAddress {
  address: string;
  family: 4 | 6;
}

export interface MetadataDnsFake {
  calls: string[];
  lookup: (hostname: string) => Promise<readonly MetadataDnsAddress[]>;
}

type DnsResult = readonly MetadataDnsAddress[] | Error;

/** A deterministic DNS resolver that never consults the host network. */
export function createMetadataDnsFake(
  records: Readonly<Record<string, DnsResult>>,
): MetadataDnsFake {
  const calls: string[] = [];

  return {
    calls,
    lookup: async (hostname) => {
      calls.push(hostname);
      const result = records[hostname];
      if (result === undefined) throw new Error(`No fake DNS result for ${hostname}.`);
      if (result instanceof Error) throw result;
      return result.map((entry) => ({ ...entry }));
    },
  };
}

export interface MetadataTransportRequest {
  url: URL;
  address: string;
  signal?: AbortSignal;
}

export interface MetadataTransportFake {
  calls: MetadataTransportRequest[];
  request: (request: MetadataTransportRequest) => Promise<Response>;
}

export interface MetadataResponseFixture {
  status?: number;
  headers?: HeadersInit;
  body?: BodyInit | null;
  error?: Error;
}

/**
 * Queue response fixtures by absolute URL. Repeated entries make redirect,
 * rebinding, and retry scenarios deterministic without outbound requests.
 */
export function createMetadataTransportFake(
  routes: Readonly<Record<string, readonly MetadataResponseFixture[]>>,
): MetadataTransportFake {
  const calls: MetadataTransportRequest[] = [];
  const remaining = new Map(
    Object.entries(routes).map(([url, responses]) => [url, [...responses]]),
  );

  return {
    calls,
    request: async (request) => {
      calls.push({ ...request, url: new URL(request.url) });

      if (request.signal?.aborted) {
        throw request.signal.reason ?? new DOMException('Aborted', 'AbortError');
      }

      const queue = remaining.get(request.url.toString());
      const fixture = queue?.shift();
      if (fixture === undefined) {
        throw new Error(`No fake metadata response for ${request.url.toString()}.`);
      }
      if (fixture.error) throw fixture.error;

      return new Response(fixture.body ?? null, {
        status: fixture.status ?? 200,
        headers: fixture.headers,
      });
    },
  };
}
