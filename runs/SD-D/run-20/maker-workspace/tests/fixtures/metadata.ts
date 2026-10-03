import type { RestrictedTransport } from '../../src/server/metadata/restrictedFetch';
export const fixtureTransport: RestrictedTransport = async (url) => ({
  url,
  statusCode: 200,
  contentType: 'text/html; charset=utf-8',
  body: Buffer.from(
    `<!doctype html><title>Fixture title</title><meta name="description" content="Fixture description">`,
  ),
});
