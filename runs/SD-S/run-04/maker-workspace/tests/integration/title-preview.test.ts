import { describe, expect, it } from 'vitest';
import { extractTitle, fetchTitle } from '../../src/server/title-preview/title-fetcher';

describe('title preview safety', () => {
  it('extracts and normalizes a safe editable title', () =>
    expect(extractTitle('<html><head><title>  A &amp; B\n guide </title></head></html>')).toBe(
      'A & B guide',
    ));
  it.each(['http://127.0.0.1', 'http://[::1]', 'http://169.254.169.254/latest/meta-data'])(
    'blocks private or special destination %s',
    async (url) =>
      expect(await fetchTitle(url)).toMatchObject({
        status: 'unavailable',
        reason: 'blocked_destination',
      }),
  );
  it('reports a missing title without executing markup', () =>
    expect(extractTitle('<html><script>throw 1</script></html>')).toBeNull());
});
