import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../../src/client/App.js';
import type { Bookmark, BookmarkInput, ReadingState } from '../../src/shared/contracts.js';
import { buildBookmark } from '../fixtures/bookmarks.js';

const QUEUED_ID = '00000000-0000-4000-8000-000000000011';
const READ_ID = '00000000-0000-4000-8000-000000000012';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const requestUrl = (input: RequestInfo | URL): URL =>
  new URL(input instanceof Request ? input.url : input.toString(), 'http://localhost');

function installLibraryApi(initialBookmarks: readonly Bookmark[]) {
  let bookmarks = initialBookmarks.map((bookmark) => ({ ...bookmark }));
  let nextId = 100;
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = requestUrl(input);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

    if (url.pathname === '/api/page-metadata' && method === 'POST') {
      const request = JSON.parse(String(init?.body)) as { url: string };
      return jsonResponse({
        requestedUrl: request.url,
        finalUrl: null,
        outcome: 'unavailable',
        title: null,
        description: null,
        message: 'Page information is unavailable. Enter a title manually.',
      });
    }

    if (url.pathname === '/api/bookmarks' && method === 'GET') {
      const visible =
        url.searchParams.get('view') === 'read-later'
          ? bookmarks.filter(({ readingState }) => readingState === 'to_read')
          : bookmarks;
      return jsonResponse({ items: visible, total: visible.length });
    }

    if (url.pathname === '/api/bookmarks' && method === 'POST') {
      const inputBody = JSON.parse(String(init?.body)) as BookmarkInput;
      const bookmark = buildBookmark({
        id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
        url: inputBody.url,
        title: inputBody.title,
        description: inputBody.description ?? '',
        tags: inputBody.tags ?? [],
        readingState: inputBody.readingState ?? 'untracked',
      });
      bookmarks = [bookmark, ...bookmarks];
      return jsonResponse(bookmark, 201);
    }

    const readingStateMatch = url.pathname.match(
      /^\/api\/bookmarks\/([^/]+)\/reading-state$/,
    );
    if (readingStateMatch && method === 'PATCH') {
      const { readingState } = JSON.parse(String(init?.body)) as {
        readingState: ReadingState;
      };
      const bookmark = bookmarks.find(({ id }) => id === readingStateMatch[1]);
      if (!bookmark) {
        return jsonResponse(
          { error: { code: 'NOT_FOUND', message: 'Bookmark not found.' } },
          404,
        );
      }
      const updated = { ...bookmark, readingState, updatedAt: '2026-09-26T12:01:00.000Z' };
      bookmarks = bookmarks.map((item) => (item.id === updated.id ? updated : item));
      return jsonResponse(updated);
    }

    throw new Error(`Unexpected ${method} request to ${url.pathname}${url.search}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, getBookmarks: () => bookmarks };
}

describe('Read Later workflow', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes URL-backed Library and Read Later tabs with ARIA keyboard behavior', async () => {
    installLibraryApi([
      buildBookmark({ id: QUEUED_ID, title: 'Queued article', readingState: 'to_read' }),
      buildBookmark({ id: READ_ID, title: 'Finished article', readingState: 'read' }),
    ]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('link', { name: 'Queued article' });
    const tablist = screen.getByRole('tablist', { name: /bookmark views/i });
    const libraryTab = within(tablist).getByRole('tab', { name: 'Library' });
    const readLaterTab = within(tablist).getByRole('tab', { name: 'Read Later' });
    expect(libraryTab).toHaveAttribute('aria-selected', 'true');
    expect(libraryTab).toHaveAttribute('tabindex', '0');
    expect(readLaterTab).toHaveAttribute('aria-selected', 'false');
    expect(readLaterTab).toHaveAttribute('tabindex', '-1');

    const libraryPanel = screen.getByRole('tabpanel', { name: 'Library' });
    expect(libraryTab).toHaveAttribute('aria-controls', libraryPanel.id);
    expect(libraryPanel).toHaveAttribute('aria-labelledby', libraryTab.id);

    libraryTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(readLaterTab).toHaveFocus();
    expect(readLaterTab).toHaveAttribute('aria-selected', 'true');
    expect(new URLSearchParams(window.location.search).get('view')).toBe('read-later');

    const readLaterPanel = await screen.findByRole('tabpanel', { name: 'Read Later' });
    expect(readLaterPanel).toHaveTextContent('Queued article');
    expect(readLaterPanel).not.toHaveTextContent('Finished article');

    await user.keyboard('{ArrowLeft}');
    expect(libraryTab).toHaveFocus();
    expect(libraryTab).toHaveAttribute('aria-selected', 'true');
  });

  it('marks the final queued item Read without deleting it, then re-queues it', async () => {
    const { fetchMock, getBookmarks } = installLibraryApi([
      buildBookmark({ id: QUEUED_ID, title: 'Queued article', readingState: 'to_read' }),
    ]);
    window.history.replaceState({}, '', '/?view=read-later');
    const user = userEvent.setup();
    render(<App />);

    const readLaterTab = await screen.findByRole('tab', { name: 'Read Later' });
    expect(readLaterTab).toHaveAttribute('aria-selected', 'true');
    const queuedCard = screen.getByRole('article', { name: 'Queued article' });
    const markRead = within(queuedCard).getByRole('button', { name: /mark.*read/i });
    markRead.focus();
    await user.keyboard('{Enter}');

    const emptyHeading = await screen.findByRole('heading', {
      name: /nothing to read later/i,
    });
    expect(emptyHeading).toBeVisible();
    expect(emptyHeading.closest('[role="status"]')).toHaveTextContent(
      /nothing to read later/i,
    );
    expect(getBookmarks()).toHaveLength(1);
    expect(getBookmarks()[0]?.readingState).toBe('read');

    await user.click(screen.getByRole('tab', { name: 'Library' }));
    const libraryCard = await screen.findByRole('article', { name: 'Queued article' });
    expect(libraryCard).toHaveTextContent(/reading status\s*read/i);
    await user.click(within(libraryCard).getByRole('button', { name: /mark.*to read/i }));

    await user.click(screen.getByRole('tab', { name: 'Read Later' }));
    expect(await screen.findByRole('article', { name: 'Queued article' })).toBeVisible();
    expect(getBookmarks()[0]?.readingState).toBe('to_read');

    const patchBodies = fetchMock.mock.calls
      .filter(([input]) => requestUrl(input).pathname.endsWith('/reading-state'))
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(patchBodies).toEqual([{ readingState: 'read' }, { readingState: 'to_read' }]);
  });

  it('creates a To Read bookmark and places it in the dedicated view', async () => {
    const { fetchMock } = installLibraryApi([]);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: /your library is empty/i });
    await user.click(screen.getByRole('button', { name: /add bookmark/i }));
    const address = screen.getByRole('textbox', { name: /web address/i });
    await user.click(address);
    await user.paste('https://example.com/read-this');
    await screen.findByText(/page information is unavailable|enter a title manually/i);
    await user.type(screen.getByRole('textbox', { name: /^title/i }), 'Read this next');
    await user.selectOptions(screen.getByRole('combobox', { name: /reading status/i }), 'to_read');
    await user.click(screen.getByRole('button', { name: /save bookmark/i }));

    await user.click(await screen.findByRole('tab', { name: 'Read Later' }));
    expect(await screen.findByRole('link', { name: 'Read this next' })).toBeVisible();
    const createCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = requestUrl(input);
      return url.pathname === '/api/bookmarks' && init?.method === 'POST';
    });
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      title: 'Read this next',
      readingState: 'to_read',
    });
  });
});
