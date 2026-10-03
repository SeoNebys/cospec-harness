export type DnsAnswer = { address: string; family: 4 | 6 };

export class MockDns {
  private readonly answers = new Map<string, DnsAnswer[]>();
  set(hostname: string, answers: DnsAnswer[]): this { this.answers.set(hostname, answers); return this; }
  async lookup(hostname: string): Promise<DnsAnswer[]> {
    const result = this.answers.get(hostname);
    if (!result) throw new Error(`Unexpected DNS lookup: ${hostname}`);
    return result;
  }
}

export class MockFetch {
  readonly calls: Array<{ url: string; init?: RequestInit }> = [];
  private readonly responses = new Map<string, () => Response>();
  respond(url: string, response: Response | (() => Response)): this {
    this.responses.set(url, typeof response === 'function' ? response : () => response.clone());
    return this;
  }
  fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    this.calls.push({ url, init });
    const response = this.responses.get(url);
    if (!response) throw new Error(`Unexpected fetch: ${url}`);
    return response();
  };
}
