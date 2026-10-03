import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../../src/client/App.js';
import type { Bookmark, BookmarkInput } from '../../src/shared/contracts.js';
import { buildBookmark } from '../fixtures/bookmarks.js';

const bookmarks: Bookmark[] = [
  buildBookmark({
    id: '00000000-0000-4000-8000-000000000021',
    title: 'Alpine guide',
    description: 'A mountain reference.',
    tags: ['Research', 'Design'],
    readingState: 'to_read',
    createdAt: '2026-09-26T12:03:00.000Z',
  }),
  buildBookmark({
    id: '00000000-0000-4000-8000-000000000022',
    title: 'Beta notes',
    tags: ['Research'],
    readingState: 'untracked',
    createdAt: '2026-09-26T12:01:00.000Z',
  }),
  buildBookmark({
    id: '00000000-0000-4000-8000-000000000023',
    title: 'Design patterns',
    tags: ['Design'],
    readingState: 'to_read',
    createdAt: '2026-09-26T12:02:00.000Z',
  }),
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const asUrl = (input: RequestInfo | URL) =>
  new URL(input instanceof Request ? input.url : input.toString(), 'http://localhost');

function installQueryApi() {
  let stored = bookmarks.map((bookmark) => ({ ...bookmark }));
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = asUrl(input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

    if (url.pathname === '/api/tags') {
      const counts = new Map<string, { name: string; count: number }>();
      for (const bookmark of stored) {
        for (const name of bookmark.tags) {
          const key = name.toLowerCase();
          const existing = counts.get(key);
          counts.set(key, { name: existing?.name ?? name, count: (existing?.count ?? 0) + 1 });
        }
      }
      return json({
        items: [...counts.entries()].map(([normalizedName, value]) => ({
          name: value.name,
          normalizedName,
          bookmarkCount: value.count,
        })),
      });
    }

    if (url.pathname === '/api/page-metadata') {
      const body = JSON.parse(String(init?.body)) as { url: string };
      return json({
        requestedUrl: body.url,
        finalUrl: null,
        outcome: 'unavailable',
        title: null,
        description: null,
        message: 'Page information is unavailable. Enter a title manually.',
      });
    }

    if (url.pathname === '/api/bookmarks' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as BookmarkInput;
      const created = buildBookmark({
        id: '00000000-0000-4000-8000-000000000024',
        url: body.url,
        title: body.title,
        description: body.description ?? '',
        tags: body.tags ?? [],
        readingState: body.readingState ?? 'untracked',
        createdAt: '2026-09-26T12:04:00.000Z',
      });
      stored = [created, ...stored];
      return json(created, 201);
    }

    if (url.pathname === '/api/bookmarks' && method === 'GET') {
      const query = (url.searchParams.get('query') ?? '').toLowerCase();
      const tags = url.searchParams.getAll('tag').map((tag) => tag.toLowerCase());
      let items = stored.filter(
        (bookmark) =>
          (url.searchParams.get('view') !== 'read-later' ||
            bookmark.readingState === 'to_read') &&
          (!query ||
            [bookmark.title, bookmark.url, bookmark.description, ...bookmark.tags]
              .join(' ')
              .toLowerCase()
              .includes(query)) &&
          tags.every((tag) => bookmark.tags.some((item) => item.toLowerCase() === tag)),
      );
      const sort = url.searchParams.get('sort') ?? 'newest';
      items = [...items].sort((left, right) => {
        if (sort === 'title') return left.title.localeCompare(right.title);
        const direction = sort === 'oldest' ? 1 : -1;
        return left.createdAt.localeCompare(right.createdAt) * direction;
      });
      return json({ items, total: items.length });
    }

    throw new Error(`Unexpected ${method} ${url.pathname}${url.search}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('library controls', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));
  afterEach(() => vi.unstubAllGlobals());

  it('restores query, repeated tags, sort, and Read Later from the URL', async () => {
    const fetchMock = installQueryApi();
    window.history.replaceState(
      {},
      '',
      '/?view=read-later&query=guide&tag=research&tag=design&sort=oldest',
    );
    render(<App />);

    expect(await screen.findByRole('tab', { name: 'Read Later' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('searchbox', { name: /search bookmarks/i })).toHaveValue('guide');
    expect(screen.getByRole('checkbox', { name: /research/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /design/i })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /sort bookmarks/i })).toHaveValue('oldest');
    expect(await screen.findByRole('link', { name: 'Alpine guide' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Beta notes' })).not.toBeInTheDocument();

    const listCall = fetchMock.mock.calls.find(([input]) => {
      const url = asUrl(input);
      return url.pathname === '/api/bookmarks' && url.searchParams.has('query');
    });
    const requested = asUrl(listCall?.[0] ?? '');
    expect(requested.searchParams.get('view')).toBe('read-later');
    expect(requested.searchParams.get('query')).toBe('guide');
    expect(requested.searchParams.getAll('tag')).toEqual(['research', 'design']);
    expect(requested.searchParams.get('sort')).toBe('oldest');
  });

  it('searches, applies AND tag filters, removes a tag, sorts, and clears no-results', async () => {
    installQueryApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('link', { name: 'Alpine guide' });

    await user.click(screen.getByRole('checkbox', { name: /research/i }));
    await user.click(screen.getByRole('checkbox', { name: /design/i }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByRole('article', { name: 'Alpine guide' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: /remove research filter/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /sort bookmarks/i }), 'title');
    await waitFor(() =>
      expect(screen.getAllByRole('article').map((article) => article.textContent)).toEqual([
        expect.stringContaining('Alpine guide'),
        expect.stringContaining('Design patterns'),
      ]),
    );

    const search = screen.getByRole('searchbox', { name: /search bookmarks/i });
    await user.type(search, 'no such bookmark');
    expect(
      await screen.findByRole('heading', { name: /no bookmarks match/i }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: /clear search and filters/i }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /design/i })).not.toBeChecked();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  });

  it('keeps active criteria after saving a matching bookmark', async () => {
    installQueryApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('link', { name: 'Alpine guide' });

    const search = screen.getByRole('searchbox', { name: /search bookmarks/i });
    await user.type(search, 'guide');
    await user.click(screen.getByRole('checkbox', { name: /design/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /sort bookmarks/i }), 'title');
    await user.click(screen.getByRole('button', { name: /add bookmark/i }));
    const address = screen.getByRole('textbox', { name: /web address/i });
    await user.click(address);
    await user.paste('https://example.com/new-guide');
    await screen.findByText(/page information is unavailable/i);
    await user.type(screen.getByRole('textbox', { name: /^title/i }), 'Guide additions');
    await user.type(screen.getByRole('textbox', { name: /^tags/i }), 'Design');
    await user.click(screen.getByRole('button', { name: /save bookmark/i }));

    expect(await screen.findByRole('link', { name: 'Guide additions' })).toBeVisible();
    expect(search).toHaveValue('guide');
    expect(screen.getByRole('checkbox', { name: /design/i })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /sort bookmarks/i })).toHaveValue('title');
    const parameters = new URLSearchParams(window.location.search);
    expect(parameters.get('query')).toBe('guide');
    expect(parameters.getAll('tag')).toContain('design');
    expect(parameters.get('sort')).toBe('title');
  });
});
