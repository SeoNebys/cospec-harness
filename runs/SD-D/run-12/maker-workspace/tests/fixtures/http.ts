export type FixtureResponse = { status: number; headers?: Record<string,string>; body: Buffer|string };
export function fixturePage(title = 'Fixture page', description = 'Fixture description'): FixtureResponse {
  return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: `<!doctype html><title>${title}</title><meta name="description" content="${description}">` };
}
