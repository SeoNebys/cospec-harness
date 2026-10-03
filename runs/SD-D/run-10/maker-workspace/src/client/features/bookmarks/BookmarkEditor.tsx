import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { BookmarkDetail, MediaSummary } from '../../../shared/contracts/bookmarks';
import type { MetadataSource } from '../../../shared/contracts/metadata';
import { ApiError, api } from '../../app/api-client';
import { NoteEditor } from '../../components/NoteEditor';
import { TagInput, type EditableTag } from '../tags/TagInput';
import { CollectionPicker, type CollectionOption } from '../collections/CollectionPicker';
import { StaleVersionDialog } from '../../components/StaleVersionDialog';
import { useDialogFocus } from '../../components/useDialogFocus';

type MetadataPreview = {
  requestedUrl: string;
  finalUrl: string;
  title: { value: string | null; source: MetadataSource; fallback?: boolean };
  description: { value: string | null; source: MetadataSource };
  favicon: { value: MediaSummary | null; source: MetadataSource };
  previewImage: { value: MediaSummary | null; source: MetadataSource };
  warnings: Array<{ field: string; code: string; message: string }>;
};

type Props = { existing?: BookmarkDetail | null; onClose(): void; onSaved(bookmark: BookmarkDetail): void };

const sourceLabels: Record<MetadataSource, string> = {
  open_graph: 'from Open Graph',
  twitter_card: 'from page card',
  html_title: 'from page title',
  meta_description: 'from page description',
  link_icon: 'from site icon',
  favicon_fallback: 'from standard icon',
  host_fallback: 'from web address',
};

export function BookmarkEditor({ existing, onClose, onSaved }: Props) {
  const dialogRef = useDialogFocus<HTMLElement>(onClose);
  const [url, setUrl] = useState(existing?.url ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [note, setNote] = useState(existing?.noteMarkdown ?? '');
  const [tags, setTags] = useState<EditableTag[]>(existing?.tags ?? []);
  const [collectionId, setCollectionId] = useState<string | null>(existing?.collection?.id ?? null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [favorite, setFavorite] = useState(existing?.isFavorite ?? false);
  const [readingState, setReadingState] = useState<'none' | 'unread' | 'read'>(
    existing?.readingState ?? 'none',
  );
  const [favicon, setFavicon] = useState<MediaSummary | null>(existing?.favicon ?? null);
  const [previewImage, setPreviewImage] = useState<MediaSummary | null>(existing?.previewImage ?? null);
  const [faviconUrl, setFaviconUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [sources, setSources] = useState<
    Partial<Record<'title' | 'description' | 'favicon' | 'previewImage', MetadataSource>>
  >({});
  const [warnings, setWarnings] = useState<MetadataPreview['warnings']>([]);
  const [metadataState, setMetadataState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [staleCurrent, setStaleCurrent] = useState<BookmarkDetail | null>(null);
  const dirty = useRef(new Set<string>(existing ? ['title', 'description', 'favicon', 'previewImage'] : []));
  const lastRequested = useRef('');

  useEffect(() => {
    void api
      .request<{ items: CollectionOption[] }>('/api/collections')
      .then((result) => setCollections(result.items));
  }, []);

  async function loadMetadata(force = false) {
    if (!/^https?:\/\//i.test(url.trim()) || (lastRequested.current === url.trim() && !force)) return;
    lastRequested.current = url.trim();
    setMetadataState('loading');
    setError('');
    try {
      const result = await api.request<MetadataPreview>('/api/metadata/preview', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!dirty.current.has('title') && result.title.value) setTitle(result.title.value);
      if (!dirty.current.has('description') && result.description.value)
        setDescription(result.description.value);
      if (!dirty.current.has('favicon')) setFavicon(result.favicon.value);
      if (!dirty.current.has('previewImage')) setPreviewImage(result.previewImage.value);
      setSources({
        title: result.title.source,
        description: result.description.source,
        favicon: result.favicon.source,
        previewImage: result.previewImage.source,
      });
      setWarnings(result.warnings);
    } catch (caught) {
      setWarnings([
        {
          field: 'metadata',
          code: 'metadata_failed',
          message:
            caught instanceof ApiError
              ? caught.problem.detail
              : 'Page details could not be retrieved. You can still save manually.',
        },
      ]);
    } finally {
      setMetadataState('done');
    }
  }

  useEffect(() => {
    if (existing || !/^https?:\/\//i.test(url.trim())) return;
    const timer = window.setTimeout(() => void loadMetadata(), 650);
    return () => window.clearTimeout(timer);
    // loadMetadata deliberately reads the latest controlled fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, existing]);

  async function captureReplacement(purpose: 'favicon' | 'preview') {
    const sourceUrl = purpose === 'favicon' ? faviconUrl : previewUrl;
    if (!sourceUrl.trim()) return;
    setError('');
    try {
      const media = await api.request<MediaSummary>('/api/media/capture', {
        method: 'POST',
        body: JSON.stringify({ purpose, url: sourceUrl.trim() }),
      });
      dirty.current.add(purpose === 'favicon' ? 'favicon' : 'previewImage');
      if (purpose === 'favicon') setFavicon(media);
      else setPreviewImage(media);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.problem.detail : 'That image could not be captured.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const body = {
      url,
      title,
      description: description || null,
      noteMarkdown: note || null,
      faviconAssetId: favicon?.id ?? null,
      previewAssetId: previewImage?.id ?? null,
      tagIds: tags.flatMap((tag) => (tag.id ? [tag.id] : [])),
      newTagNames: tags.filter((tag) => !tag.id).map((tag) => tag.name),
      collectionId,
      isFavorite: favorite,
      readingState,
      ...(existing ? { expectedVersion: existing.version } : {}),
    };
    try {
      const saved = await api.request<BookmarkDetail>(
        existing ? `/api/bookmarks/${existing.id}` : '/api/bookmarks',
        { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(body) },
      );
      onSaved(saved);
    } catch (caught) {
      if (caught instanceof ApiError && caught.problem.code === 'stale_version') {
        const current = (caught.problem as typeof caught.problem & { current?: BookmarkDetail }).current;
        if (current) setStaleCurrent(current);
      }
      setError(caught instanceof ApiError ? caught.problem.detail : 'The bookmark could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const label = (field: keyof typeof sources) => (sources[field] ? sourceLabels[sources[field]!] : null);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="editor-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <header className="panel-header">
          <div>
            <p className="eyebrow">{existing ? 'Refine what you kept' : 'A new keeper'}</p>
            <h2 id="editor-title">{existing ? 'Edit bookmark' : 'Save a bookmark'}</h2>
          </div>
          <button className="icon-button icon-button--large" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="field-group field-group--url">
            <label htmlFor="bookmark-url">Web address</label>
            <div className="url-row">
              <input
                id="bookmark-url"
                type="url"
                required
                maxLength={4096}
                value={url}
                placeholder="https://…"
                onChange={(event) => {
                  setUrl(event.target.value);
                  lastRequested.current = '';
                }}
              />
              <button
                className="button button--soft"
                type="button"
                disabled={metadataState === 'loading' || !url}
                onClick={() => void loadMetadata(true)}
              >
                {metadataState === 'loading' ? 'Gathering…' : 'Fetch details'}
              </button>
            </div>
            <span className="field-hint">Paste a link and Keepwell will gather its details for you.</span>
          </div>

          {metadataState === 'loading' && (
            <div className="metadata-progress">
              <span />
              <p>
                <strong>Visiting the page…</strong>
                <br />
                Looking for its title, description and imagery.
              </p>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="metadata-warnings" role="status">
              {warnings.map((warning, index) => (
                <p key={`${warning.field}-${index}`}>◌ {warning.message}</p>
              ))}
            </div>
          )}

          <div className="form-grid">
            <label>
              Title <small>{label('title')}</small>
              <input
                required
                maxLength={300}
                value={title}
                onChange={(event) => {
                  dirty.current.add('title');
                  setTitle(event.target.value);
                }}
              />
            </label>
            <label className="span-2">
              Short description <small>{label('description')}</small>
              <textarea
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(event) => {
                  dirty.current.add('description');
                  setDescription(event.target.value);
                }}
              />
            </label>
          </div>

          <div className="visual-grid">
            <div className="visual-field">
              <div className="field-label">
                <span>Site icon</span>
                <small>{label('favicon')}</small>
              </div>
              <div className="visual-preview visual-preview--icon">
                {favicon ? <img src={favicon.url} alt="Current site icon" /> : <span>—</span>}
              </div>
              <div className="replace-row">
                <input
                  type="url"
                  aria-label="Replacement site icon URL"
                  placeholder="Replacement image URL"
                  value={faviconUrl}
                  onChange={(event) => setFaviconUrl(event.target.value)}
                />
                <button type="button" onClick={() => void captureReplacement('favicon')}>
                  Use
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dirty.current.add('favicon');
                    setFavicon(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="visual-field">
              <div className="field-label">
                <span>Preview image</span>
                <small>{label('previewImage')}</small>
              </div>
              <div className="visual-preview">
                {previewImage ? (
                  <img src={previewImage.url} alt="Current preview" />
                ) : (
                  <span>No image found</span>
                )}
              </div>
              <div className="replace-row">
                <input
                  type="url"
                  aria-label="Replacement preview image URL"
                  placeholder="Replacement image URL"
                  value={previewUrl}
                  onChange={(event) => setPreviewUrl(event.target.value)}
                />
                <button type="button" onClick={() => void captureReplacement('preview')}>
                  Use
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dirty.current.add('previewImage');
                    setPreviewImage(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <section className="organization-fields">
            <div>
              <span className="field-label">
                Tags <small>Primary organization</small>
              </span>
              <TagInput value={tags} onChange={setTags} />
            </div>
            <CollectionPicker value={collectionId} options={collections} onChange={setCollectionId} />
            <label className="check-field">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(event) => setFavorite(event.target.checked)}
              />{' '}
              Favorite
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={readingState === 'unread'}
                onChange={(event) => setReadingState(event.target.checked ? 'unread' : 'none')}
              />{' '}
              Add to Read Later
            </label>
          </section>

          <label className="note-label">
            Your note <small>Optional · formatting supported</small>
          </label>
          <NoteEditor value={note} onChange={setNote} />
          {error && (
            <div className="message message--error" role="alert">
              {error}
            </div>
          )}
          <footer className="panel-actions">
            <button className="button button--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button button--primary" disabled={saving || !url || !title} type="submit">
              {saving ? 'Saving…' : existing ? 'Save changes' : 'Keep this bookmark'}
            </button>
          </footer>
        </form>
      </section>
      {staleCurrent && (
        <StaleVersionDialog
          current={staleCurrent}
          onKeepEditing={() => setStaleCurrent(null)}
          onReload={() => onSaved(staleCurrent)}
        />
      )}
    </div>
  );
}
