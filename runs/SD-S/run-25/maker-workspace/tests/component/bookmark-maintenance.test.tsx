import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../../src/client/App.js';
import type { Bookmark, BookmarkInput } from '../../src/shared/contracts.js';
import { buildBookmark } from '../fixtures/bookmarks.js';

const BOOKMARK_ID = '00000000-0000-4000-8000-000000000031';
const original = buildBookmark({
  id: BOOKMARK_ID,
  url: 'https://example.com/original',
  title: 'Keep article',
  description: 'Original notes',
  tags: ['Research'],
  readingState: 'to_read',
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const asUrl = (input: RequestInfo | URL) =>
  new URL(input instanceof Request ? input.url : input.toString(), 'http://localhost');

function installMaintenanceApi() {
  let stored: Bookmark[] = [{ ...original }];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = asUrl(input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (url.pathname === '/api/tags') {
      const names = [...new Set(stored.flatMap(({ tags }) => tags))];
      return json({
        items: names.map((name) => ({
          name,
          normalizedName: name.toLowerCase(),
          bookmarkCount: stored.filter(({ tags }) => tags.includes(name)).length,
        })),
      });
    }
    if (url.pathname === '/api/page-metadata') {
      const { url: requestedUrl } = JSON.parse(String(init?.body)) as { url: string };
      return requestedUrl.includes('manual')
        ? json({
            requestedUrl,
            finalUrl: null,
            outcome: 'unavailable',
            title: null,
            description: null,
            message: 'Page information is unavailable. Existing details remain editable.',
          })
        : json({
            requestedUrl,
            finalUrl: requestedUrl,
            outcome: 'complete',
            title: 'Fetched replacement title',
            description: 'Fetched replacement description',
          });
    }
    if (url.pathname === '/api/bookmarks' && method === 'GET') {
      const query = (url.searchParams.get('query') ?? '').toLowerCase();
      const tags = url.searchParams.getAll('tag');
      const items = stored.filter(
        (bookmark) =>
          (url.searchParams.get('view') !== 'read-later' || bookmark.readingState === 'to_read') &&
          (!query || bookmark.title.toLowerCase().includes(query)) &&
          tags.every((tag) => bookmark.tags.some((item) => item.toLowerCase() === tag)),
      );
      return json({ items, total: items.length });
    }
    if (url.pathname === `/api/bookmarks/${BOOKMARK_ID}` && method === 'PUT') {
      const body = JSON.parse(String(init?.body)) as BookmarkInput;
      const updated = {
        ...stored[0]!,
        ...body,
        description: body.description ?? '',
        tags: body.tags ?? [],
        readingState: body.readingState ?? 'untracked',
        updatedAt: '2026-09-26T13:00:00.000Z',
      } as Bookmark;
      stored = [updated];
      return json(updated);
    }
    if (url.pathname === `/api/bookmarks/${BOOKMARK_ID}` && method === 'DELETE') {
      stored = [];
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected ${method} ${url.pathname}${url.search}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, stored: () => stored };
}

describe('bookmark maintenance', () => {
  beforeEach(() =>
    window.history.replaceState({}, '', '/?query=keep&tag=research&sort=title'),
  );
  afterEach(() => vi.unstubAllGlobals());

  it('prefills edit fields, protects existing details from metadata, and retains criteria', async () => {
    const { fetchMock, stored } = installMaintenanceApi();
    const user = userEvent.setup();
    render(<App />);
    const card = await screen.findByRole('article', { name: 'Keep article' });
    await user.click(within(card).getByRole('button', { name: /edit/i }));

    expect(screen.getByRole('textbox', { name: /web address/i })).toHaveValue(original.url);
    expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue(original.title);
    expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue(original.description);
    expect(screen.getByRole('textbox', { name: /^tags/i })).toHaveValue('Research');
    expect(screen.getByRole('combobox', { name: /reading status/i })).toHaveValue('to_read');

    const address = screen.getByRole('textbox', { name: /web address/i });
    await user.clear(address);
    await user.type(address, 'https://example.com/updated');
    await screen.findByText(/page information.*ready|retrieved/i);
    expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('Keep article');
    expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue('Original notes');

    await user.clear(screen.getByRole('textbox', { name: /^title/i }));
    await user.type(screen.getByRole('textbox', { name: /^title/i }), 'Keep article revised');
    await user.clear(screen.getByRole('textbox', { name: /description/i }));
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'Revised notes');
    await user.clear(screen.getByRole('textbox', { name: /^tags/i }));
    await user.type(screen.getByRole('textbox', { name: /^tags/i }), 'Research, Updated');
    await user.selectOptions(screen.getByRole('combobox', { name: /reading status/i }), 'read');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('link', { name: 'Keep article revised' })).toBeVisible();
    expect(stored()[0]).toMatchObject({
      url: 'https://example.com/updated',
      title: 'Keep article revised',
      description: 'Revised notes',
      tags: ['Research', 'Updated'],
      readingState: 'read',
    });
    const parameters = new URLSearchParams(window.location.search);
    expect(parameters.get('query')).toBe('keep');
    expect(parameters.getAll('tag')).toEqual(['research']);
    expect(parameters.get('sort')).toBe('title');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true);
  });

  it('keeps manual editing available when metadata for a changed URL is unavailable', async () => {
    installMaintenanceApi();
    const user = userEvent.setup();
    render(<App />);
    const card = await screen.findByRole('article', { name: 'Keep article' });
    await user.click(within(card).getByRole('button', { name: /edit/i }));
    const address = screen.getByRole('textbox', { name: /web address/i });
    await user.clear(address);
    await user.type(address, 'https://example.com/manual');
    await screen.findByText(/unavailable.*editable/i);
    const title = screen.getByRole('textbox', { name: /^title/i });
    await user.clear(title);
    await user.type(title, 'Keep manual title');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled();
  });

  it('uses inline Cancel-first deletion and removes the bookmark from every view', async () => {
    const { stored } = installMaintenanceApi();
    const user = userEvent.setup();
    render(<App />);
    const card = await screen.findByRole('article', { name: 'Keep article' });
    const deleteTrigger = within(card).getByRole('button', { name: /delete/i });
    await user.click(deleteTrigger);
    const confirmation = within(card).getByRole('group', { name: /delete keep article/i });
    const cancel = within(confirmation).getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveFocus();
    await user.click(cancel);
    expect(deleteTrigger).toHaveFocus();
    expect(screen.getByRole('article', { name: 'Keep article' })).toBeVisible();

    await user.click(deleteTrigger);
    await user.click(within(card).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(stored()).toEqual([]));
    expect(screen.queryByRole('article', { name: 'Keep article' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /research/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveFocus();
    await user.click(screen.getByRole('tab', { name: 'Read Later' }));
    expect(screen.queryByRole('article', { name: 'Keep article' })).not.toBeInTheDocument();
  });
});
