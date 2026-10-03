import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BookmarkForm } from '../../src/client/features/bookmarks/BookmarkForm.js';
import type { Bookmark, MetadataPreview } from '../../src/shared/contracts.js';
import { buildBookmark } from '../fixtures/bookmarks.js';

const PAGE_URL = 'https://example.com/guide';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const metadataResponse = (
  overrides: Partial<MetadataPreview> = {},
): MetadataPreview => ({
  requestedUrl: PAGE_URL,
  finalUrl: PAGE_URL,
  outcome: 'complete',
  title: 'Example guide',
  description: 'A concise guide from the example site.',
  ...overrides,
});

const requestUrl = (input: RequestInfo | URL): string =>
  input instanceof Request ? input.url : input.toString();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('BookmarkForm', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('announces metadata loading and success, then fills editable suggestions', async () => {
    const metadata = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      if (requestUrl(input).endsWith('/api/page-metadata')) return metadata.promise;
      throw new Error(`Unexpected request to ${requestUrl(input)}`);
    });
    const user = userEvent.setup();
    render(<BookmarkForm onSaved={vi.fn()} />);

    await user.click(screen.getByRole('textbox', { name: /web address/i }));
    await user.paste(PAGE_URL);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent(/retrieving page information/i);

    metadata.resolve(jsonResponse(metadataResponse()));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /page information (is )?(ready|retrieved)/i,
      ),
    );
    const title = screen.getByRole('textbox', { name: /^title/i });
    const description = screen.getByRole('textbox', { name: /description/i });
    expect(title).toHaveValue('Example guide');
    expect(description).toHaveValue('A concise guide from the example site.');

    await user.clear(title);
    await user.type(title, 'My edited title');
    await user.clear(description);
    await user.type(description, 'My edited notes');
    expect(title).toHaveValue('My edited title');
    expect(description).toHaveValue('My edited notes');
  });

  it('announces partial metadata and leaves missing information available for manual entry', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        metadataResponse({
          outcome: 'partial',
          description: null,
          message: 'No page description was found. You can enter one manually.',
        }),
      ),
    );
    const user = userEvent.setup();
    render(<BookmarkForm onSaved={vi.fn()} />);

    await user.click(screen.getByRole('textbox', { name: /web address/i }));
    await user.paste(PAGE_URL);

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /incomplete|description.*manually/i,
      ),
    );
    expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('Example guide');
    const description = screen.getByRole('textbox', { name: /description/i });
    expect(description).toHaveValue('');
    await user.type(description, 'Notes supplied by the user');
    expect(description).toHaveValue('Notes supplied by the user');
  });

  it('keeps saving available through manual fallback when metadata is unavailable', async () => {
    const saved = buildBookmark({
      url: PAGE_URL,
      title: 'Manually titled page',
      description: '',
      tags: [],
      readingState: 'untracked',
    });
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          metadataResponse({
            finalUrl: null,
            outcome: 'unavailable',
            title: null,
            description: null,
            message: 'Page information is unavailable. Enter a title manually.',
          }),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(saved, 201));
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<BookmarkForm onSaved={onSaved} />);

    await user.click(screen.getByRole('textbox', { name: /web address/i }));
    await user.paste(PAGE_URL);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /unavailable|enter a title manually/i,
      ),
    );
    await user.type(screen.getByRole('textbox', { name: /^title/i }), 'Manually titled page');
    await user.click(screen.getByRole('button', { name: /save bookmark/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    const saveCall = fetchMock.mock.calls.find(([input]) =>
      requestUrl(input).endsWith('/api/bookmarks'),
    );
    expect(saveCall).toBeDefined();
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
      url: PAGE_URL,
      title: 'Manually titled page',
    });
  });

  it('does not overwrite user edits when metadata completes later', async () => {
    const metadata = deferred<Response>();
    fetchMock.mockReturnValueOnce(metadata.promise);
    const user = userEvent.setup();
    render(<BookmarkForm onSaved={vi.fn()} />);

    await user.click(screen.getByRole('textbox', { name: /web address/i }));
    await user.paste(PAGE_URL);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.type(screen.getByRole('textbox', { name: /^title/i }), 'My title');
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'My notes');
    metadata.resolve(jsonResponse(metadataResponse()));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/page information/i),
    );
    expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('My title');
    expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue('My notes');
  });

  it('ignores a late response for URL A after URL B has been entered', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const user = userEvent.setup();
    render(<BookmarkForm onSaved={vi.fn()} />);
    const address = screen.getByRole('textbox', { name: /web address/i });

    await user.click(address);
    await user.paste('https://a.example/article');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.clear(address);
    await user.paste('https://b.example/article');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    second.resolve(
      jsonResponse(
        metadataResponse({
          requestedUrl: 'https://b.example/article',
          finalUrl: 'https://b.example/article',
          title: 'Title from B',
          description: 'Description from B',
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('Title from B'),
    );

    first.resolve(
      jsonResponse(
        metadataResponse({
          requestedUrl: 'https://a.example/article',
          finalUrl: 'https://a.example/article',
          title: 'Late title from A',
          description: 'Late description from A',
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('Title from B'),
    );
    expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue(
      'Description from B',
    );
  });

  it('treats a type-then-clear field as user edited when metadata arrives', async () => {
    const metadata = deferred<Response>();
    fetchMock.mockReturnValueOnce(metadata.promise);
    const user = userEvent.setup();
    render(<BookmarkForm onSaved={vi.fn()} />);

    await user.click(screen.getByRole('textbox', { name: /web address/i }));
    await user.paste(PAGE_URL);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const title = screen.getByRole('textbox', { name: /^title/i });
    await user.type(title, 'Temporary title');
    await user.clear(title);

    metadata.resolve(jsonResponse(metadataResponse()));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue(
        'A concise guide from the example site.',
      ),
    );
    expect(title).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue(
      'A concise guide from the example site.',
    );
  });

  it('shows associated validation guidance and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    render(<BookmarkForm onSaved={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: /web address/i }), 'file:///notes.txt');
    await user.click(screen.getByRole('button', { name: /save bookmark/i }));

    const address = screen.getByRole('textbox', { name: /web address/i });
    expect(address).toHaveFocus();
    expect(address).toHaveAccessibleDescription(/absolute HTTP or HTTPS URL/i);
    expect(screen.getByRole('textbox', { name: /^title/i })).toHaveAccessibleDescription(
      /enter a title/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers open-existing and save-anyway choices after a duplicate response', async () => {
    const existing = buildBookmark({
      url: PAGE_URL,
      title: 'Existing guide',
      tags: [],
      readingState: 'untracked',
    });
    const duplicate: Bookmark = buildBookmark({
      id: '00000000-0000-4000-8000-000000000002',
      url: PAGE_URL,
      title: 'Another copy',
      tags: [],
      readingState: 'untracked',
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(metadataResponse()))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { code: 'DUPLICATE_URL', message: 'This address is already saved.' },
            existingBookmark: existing,
          },
          409,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(duplicate, 201));
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<BookmarkForm onSaved={onSaved} />);

    await user.click(screen.getByRole('textbox', { name: /web address/i }));
    await user.paste(PAGE_URL);
    await screen.findByDisplayValue('Example guide');
    await user.click(screen.getByRole('button', { name: /save bookmark/i }));

    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent(/already saved/i);
    const openExisting = screen.getByRole('link', { name: /open existing bookmark/i });
    expect(openExisting).toHaveAttribute('href', PAGE_URL);
    expect(openExisting).toHaveAttribute('target', '_blank');
    expect(openExisting).toHaveAttribute('rel', expect.stringMatching(/noopener/));

    await user.click(screen.getByRole('button', { name: /save anyway/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(duplicate));
    const saveCalls = fetchMock.mock.calls.filter(([input]) =>
      requestUrl(input).endsWith('/api/bookmarks'),
    );
    expect(saveCalls).toHaveLength(2);
    expect(JSON.parse(String(saveCalls[1]?.[1]?.body))).toMatchObject({
      url: PAGE_URL,
      allowDuplicate: true,
    });
  });
});
