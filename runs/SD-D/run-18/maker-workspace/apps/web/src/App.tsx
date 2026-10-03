import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Bookmark, type Tag } from './api.js';
import { Icon } from './components/Icons.js';
import { Modal } from './components/Modal.js';
import { RichNoteEditor } from './features/notes/RichNoteEditor.js';
import { RichNoteView } from './features/notes/RichNoteView.js';

type Section = 'library' | 'unread' | 'archived' | 'saved' | 'portability' | 'settings';
const previewMarkdown = (v: string) => {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escape(v)
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/\n/g, '<br>');
};
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
const relative = (value: string) => {
  const then = new Date(value).getTime(),
    delta = Math.max(0, Date.now() - then),
    days = Math.floor(delta / 86400000);
  return days === 0
    ? 'today'
    : days === 1
      ? 'yesterday'
      : days < 30
        ? `${days} days ago`
        : new Date(value).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year:
              new Date(value).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
          });
};

function SaveBookmark({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (b: Bookmark) => void;
}) {
  const [form, setForm] = useState<any>({
    url: '',
    title: '',
    description: '',
    tags: '',
    noteMarkdown: '',
    faviconUrl: null,
    previewImageUrl: null,
    readStatus: 'unread',
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const timer = useRef<number | null>(null);
  const updateUrl = (url: string) => {
    setForm((f: any) => ({ ...f, url }));
    setError('');
    setStatus('');
    if (timer.current) clearTimeout(timer.current);
    if (/^https?:\/\//i.test(url))
      timer.current = window.setTimeout(async () => {
        setStatus('Fetching page details…');
        try {
          const m = await api.metadata(url);
          setForm((f: any) => ({ ...f, ...m, url }));
          setStatus('Details found — everything remains editable.');
        } catch (e) {
          setError((e as Error).message);
          setStatus('');
        }
      }, 650);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('Saving…');
    try {
      const b = await api.create({
        ...form,
        tags: form.tags
          .split(',')
          .map((x: string) => x.trim())
          .filter(Boolean),
      });
      onSaved(b);
    } catch (e) {
      setError((e as Error).message);
      setStatus('');
    }
  };
  return (
    <Modal title="Save a bookmark" onClose={onClose}>
      <form onSubmit={submit} className="form-stack">
        <label>
          Web address
          <input
            autoFocus
            required
            type="url"
            value={form.url}
            onChange={(e) => updateUrl(e.target.value)}
            placeholder="https://example.com/article"
          />
        </label>
        {status && (
          <div className="fetch-status">
            <span className={status.startsWith('Fetching') ? 'spinner' : ''} />
            {status}
          </div>
        )}
        {error && <div className="alert error">{error}</div>}
        <div className="metadata-preview">
          {form.previewImageUrl ? (
            <img src={form.previewImageUrl} alt="" />
          ) : (
            <div className="preview-placeholder">
              <Icon name="bookmark" />
            </div>
          )}
          <div>
            {form.faviconUrl && <img className="favicon" src={form.faviconUrl} alt="" />}
            <strong>{form.title || 'Page title will appear here'}</strong>
            <small>
              {form.description ||
                'The page description and preview will be filled in automatically.'}
            </small>
          </div>
        </div>
        <details className="image-controls">
          <summary>Adjust page images</summary>
          <div className="field-grid">
            <label>
              Site icon address
              <input
                value={form.faviconUrl ?? ''}
                onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })}
                placeholder="Leave empty for no icon"
              />
            </label>
            <label>
              Preview image address
              <input
                value={form.previewImageUrl ?? ''}
                onChange={(e) => setForm({ ...form, previewImageUrl: e.target.value })}
                placeholder="Leave empty for no preview"
              />
            </label>
          </div>
        </details>
        <label>
          Title
          <input
            required
            maxLength={500}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            maxLength={4000}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          Tags <span className="hint">comma separated</span>
          <input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="research, design"
          />
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={form.readStatus === 'read'}
            onChange={(e) => setForm({ ...form, readStatus: e.target.checked ? 'read' : 'unread' })}
          />
          I have already read this
        </label>
        <footer className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!form.url || !form.title}>
            Save bookmark
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function BookmarkEditor({
  bookmark,
  onClose,
  onChanged,
  onDelete,
}: {
  bookmark: Bookmark;
  onClose: () => void;
  onChanged: (b?: Bookmark) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<any>({
    ...bookmark,
    tags: bookmark.tags.map((t) => t.name).join(', '),
  });
  const [error, setError] = useState('');
  const [reader, setReader] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const b = await api.update(bookmark.id, {
        ...form,
        tags: form.tags
          .split(',')
          .map((x: string) => x.trim())
          .filter(Boolean),
        version: bookmark.version,
      });
      onChanged(b);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const copyAction = async () => {
    if (bookmark.copyStatus === 'available') {
      setReader(true);
      return;
    }
    try {
      await api.action(bookmark.id, 'capture');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (reader)
    return (
      <Modal title={`Saved copy — ${bookmark.title}`} onClose={() => setReader(false)} wide>
        <div className="reader-toolbar">
          <span>
            {bookmark.savedCopy?.kind === 'pdf' ? 'Original PDF' : 'Readable page copy'} · captured{' '}
            {bookmark.savedCopy && relative(bookmark.savedCopy.capturedAt)}
          </span>
          <a className="secondary button" href={`/api/bookmarks/${bookmark.id}/copy/download`}>
            Download
          </a>
        </div>
        <iframe
          className="saved-reader"
          sandbox=""
          src={`/saved/${bookmark.id}`}
          title={`Saved copy of ${bookmark.title}`}
        />
      </Modal>
    );
  return (
    <Modal title="Bookmark details" onClose={onClose} wide>
      <form onSubmit={save} className="form-stack">
        <div className="detail-heading">
          <div className="site-icon">
            {bookmark.faviconUrl ? (
              <img src={bookmark.faviconUrl} alt="" />
            ) : (
              bookmark.title[0]?.toUpperCase()
            )}
          </div>
          <div>
            <a href={bookmark.url} target="_blank" rel="noreferrer">
              {host(bookmark.url)} <Icon name="external" />
            </a>
            <span>Saved {relative(bookmark.createdAt)}</span>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="field-grid">
          <label>
            Title
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Web address
            <input
              required
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            rows={3}
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <details className="image-controls">
          <summary>Adjust page images</summary>
          <div className="field-grid">
            <label>
              Site icon address
              <input
                value={form.faviconUrl ?? ''}
                onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })}
              />
            </label>
            <label>
              Preview image address
              <input
                value={form.previewImageUrl ?? ''}
                onChange={(e) => setForm({ ...form, previewImageUrl: e.target.value })}
              />
            </label>
          </div>
        </details>
        <label>
          Tags <span className="hint">comma separated</span>
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </label>
        <label>Note</label>
        <RichNoteEditor
          value={form.noteMarkdown}
          onChange={(v) => setForm({ ...form, noteMarkdown: v })}
          previewHtml={previewMarkdown(form.noteMarkdown)}
        />
        <div className={`copy-panel ${bookmark.copyStatus}`}>
          <div>
            <strong>
              {bookmark.copyStatus === 'available'
                ? bookmark.capturePending
                  ? 'Refreshing copy — current copy is still ready'
                  : 'Saved copy ready'
                : bookmark.copyStatus === 'pending'
                  ? 'Saving a readable copy…'
                  : 'Could not save a copy'}
            </strong>
            <span>
              {bookmark.copyStatus === 'available' && bookmark.savedCopy
                ? `${bookmark.savedCopy.kind.toUpperCase()} · ${(bookmark.savedCopy.size / 1024).toFixed(0)} KB · ${new Date(bookmark.savedCopy.capturedAt).toLocaleString()}`
                : bookmark.copyErrorCode ||
                  'You can keep organizing this bookmark while capture runs.'}
            </span>
            {bookmark.savedCopy && !bookmark.savedCopy.matchesCurrentUrl && (
              <span className="copy-warning">
                This copy is from the previous address. Refresh it when you are ready.
              </span>
            )}
          </div>
          <button type="button" className="secondary" onClick={copyAction}>
            {bookmark.copyStatus === 'available' ? 'Read saved copy' : 'Retry'}
          </button>
          {bookmark.copyStatus === 'available' &&
            !bookmark.capturePending &&
            !bookmark.candidateCopy && (
            <button
              type="button"
              className="text-button"
              onClick={async () => {
                if (
                  confirm(
                    'Capture a fresh copy? The current copy stays available until the new one succeeds.',
                  )
                ) {
                  await api.action(bookmark.id, 'capture');
                  onChanged();
                }
              }}
            >
              Refresh copy
            </button>
          )}
        </div>
        {bookmark.candidateCopy && (
          <div className="candidate-panel">
            <div>
              <strong>A fresh copy is ready</strong>
              <span>
                {bookmark.candidateCopy.kind.toUpperCase()} ·{' '}
                {(bookmark.candidateCopy.size / 1024).toFixed(0)} KB · captured{' '}
                {new Date(bookmark.candidateCopy.capturedAt).toLocaleString()}
              </span>
              <small>Your current copy remains readable until you choose.</small>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                await api.action(bookmark.id, 'capture/discard');
                onChanged();
              }}
            >
              Keep current
            </button>
            <button
              type="button"
              className="primary"
              onClick={async () => {
                await api.action(bookmark.id, 'capture/confirm');
                onChanged();
              }}
            >
              Use fresh copy
            </button>
          </div>
        )}
        {bookmark.noteHtml && (
          <details>
            <summary>Current rendered note</summary>
            <RichNoteView html={bookmark.noteHtml} />
          </details>
        )}
        <footer className="modal-actions split">
          <button type="button" className="danger-text" onClick={onDelete}>
            Delete permanently
          </button>
          <span />
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save changes</button>
        </footer>
      </form>
    </Modal>
  );
}

function BookmarkCard({
  bookmark,
  selected,
  onSelect,
  onOpen,
  onAction,
}: {
  bookmark: Bookmark;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <article className={`bookmark-card ${selected ? 'selected' : ''}`}>
      <label className="select-box">
        <input type="checkbox" checked={selected} onChange={onSelect} />
        <span />
      </label>
      {bookmark.previewImageUrl ? (
        <img className="card-image" src={bookmark.previewImageUrl} alt="" loading="lazy" />
      ) : (
        <div className="card-image placeholder">
          <span>{host(bookmark.url).slice(0, 2).toUpperCase()}</span>
        </div>
      )}
      <div className="card-body">
        <div className="card-top">
          <div className="site-line">
            {bookmark.faviconUrl && <img src={bookmark.faviconUrl} alt="" />}
            <span>{host(bookmark.url)}</span>
          </div>
          <button className="icon-button" aria-label={`Edit ${bookmark.title}`} onClick={onOpen}>
            <Icon name="more" />
          </button>
        </div>
        <button className="card-title" onClick={onOpen}>
          {bookmark.title}
        </button>
        {bookmark.description && <p>{bookmark.description}</p>}
        <div className="tag-row">
          {bookmark.tags.map((t) => (
            <span key={t.id}>#{t.name}</span>
          ))}
        </div>
        <div className="card-meta">
          <span
            className={`status-dot ${bookmark.copyStatus}`}
            title={`Saved copy: ${bookmark.copyStatus}`}
          />
          <span>
            {bookmark.copyStatus === 'available'
              ? 'copy saved'
              : bookmark.copyStatus === 'pending'
                ? 'saving copy'
                : 'copy failed'}
          </span>
          <span>·</span>
          <span>{relative(bookmark.createdAt)}</span>
        </div>
      </div>
      <div className="card-actions">
        <button
          className="quiet"
          onClick={() => onAction(bookmark.readStatus === 'read' ? 'unread' : 'read')}
        >
          <Icon name="check" />
          {bookmark.readStatus === 'read' ? 'Unread' : 'Read'}
        </button>
        <button
          className="quiet"
          onClick={() => onAction(bookmark.archivedAt ? 'restore' : 'archive')}
        >
          <Icon name="archive" />
          {bookmark.archivedAt ? 'Restore' : 'Archive'}
        </button>
        <a className="quiet" href={bookmark.url} target="_blank" rel="noreferrer">
          <Icon name="external" />
          Open
        </a>
      </div>
    </article>
  );
}

function Portability({ onImported }: { onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<any>(null),
    [progress, setProgress] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [scope, setScope] = useState('all'),
    [ack, setAck] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!result?.id) return;
    let stopped = false;
    const check = async () => {
      const status = await api.importStatus(result.id);
      if (!stopped) setProgress(status.progress);
      if (!stopped && status.progress?.pending) window.setTimeout(check, 1800);
    };
    void check();
    return () => {
      stopped = true;
    };
  }, [result?.id]);
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Bring your collection with you</span>
          <h1>Import & export</h1>
          <p>Move bookmarks from common browsers or take a portable copy with you.</p>
        </div>
      </div>
      <section className="settings-card">
        <div className="section-icon">
          <Icon name="download" />
        </div>
        <div>
          <h2>Import browser bookmarks</h2>
          <p>
            Choose a Netscape bookmark HTML file exported by Chrome, Firefox, Safari, or another
            browser. Folder names become tags, and every new bookmark starts unread with a
            saved-copy job.
          </p>
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error && <div className="alert error">{error}</div>}
          {result && (
            <div className="import-result">
              <strong>Import complete</strong>
              <span>
                {result.created} added · {result.duplicates} duplicates · {result.skipped} skipped
              </span>
              {progress && (
                <span>
                  Saved copies: {progress.available ?? 0} ready · {progress.pending ?? 0} pending ·{' '}
                  {progress.failed ?? 0} failed
                </span>
              )}
              {result.issues?.slice(0, 4).map((i: any, n: number) => (
                <small key={n}>{i.message}</small>
              ))}
            </div>
          )}
          <button
            className="primary"
            disabled={!file || busy}
            onClick={async () => {
              if (!file) return;
              setBusy(true);
              setError('');
              try {
                setResult(await api.import(file));
                onImported();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Importing…' : 'Import bookmarks'}
          </button>
        </div>
      </section>
      <section className="settings-card">
        <div className="section-icon">
          <Icon name="external" />
        </div>
        <div>
          <h2>Export bookmarks</h2>
          <p>
            Browser bookmark files contain links and titles only. Tags, notes, read and archive
            state, images, saved copies, saved searches, and preferences will not be included.
          </p>
          <label>
            Collection
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">All bookmarks</option>
              <option value="active">Active bookmarks</option>
              <option value="archived">Archived bookmarks</option>
            </select>
          </label>
          <label className="check-line">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I
            understand which information the browser format cannot carry.
          </label>
          <a
            className={`button primary ${!ack ? 'disabled' : ''}`}
            aria-disabled={!ack}
            href={ack ? `/api/exports?scope=${scope}` : undefined}
          >
            Export HTML file
          </a>
        </div>
      </section>
    </div>
  );
}

function Preferences({ value, onSave }: { value: any; onSave: (v: any) => void }) {
  const [form, setForm] = useState(value);
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Make it yours</span>
          <h1>Display preferences</h1>
          <p>Choose how your collection looks when you return.</p>
        </div>
      </div>
      <section className="settings-card">
        <div className="section-icon">
          <Icon name="settings" />
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const saved = await api.savePreferences(form);
            localStorage.setItem('textSize', saved.textSize);
            document.documentElement.dataset.textSize = saved.textSize;
            onSave(saved);
          }}
        >
          <h2>Collection display</h2>
          <div className="field-grid">
            <label>
              Default sort
              <select
                value={form.defaultSort}
                onChange={(e) => setForm({ ...form, defaultSort: e.target.value })}
              >
                <option value="created_at">Date saved</option>
                <option value="updated_at">Last updated</option>
                <option value="title">Title</option>
              </select>
            </label>
            <label>
              Direction
              <select
                value={form.sortDirection}
                onChange={(e) => setForm({ ...form, sortDirection: e.target.value })}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Text size</legend>
            <div className="size-options">
              {['small', 'medium', 'large'].map((size) => (
                <label key={size} className={form.textSize === size ? 'chosen' : ''}>
                  <input
                    type="radio"
                    name="size"
                    value={size}
                    checked={form.textSize === size}
                    onChange={() => setForm({ ...form, textSize: size })}
                  />
                  <span className={`sample ${size}`}>Aa</span>
                  <strong>{size.charAt(0).toUpperCase() + size.slice(1)}</strong>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="primary">Save preferences</button>
        </form>
      </section>
    </div>
  );
}

function SavedViewManager({
  views,
  tags,
  onClose,
  onChanged,
}: {
  views: any[];
  tags: Tag[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [active, setActive] = useState(views[0]?.id ?? ''),
    view = views.find((v) => v.id === active);
  const [form, setForm] = useState<any>(
    view ? { name: view.name, query: view.query, tagIds: view.tagIds ?? [] } : null,
  );
  useEffect(() => {
    const next = views.find((v) => v.id === active);
    setForm(next ? { name: next.name, query: next.query, tagIds: next.tagIds ?? [] } : null);
  }, [active, views]);
  return (
    <Modal title="Manage saved views" onClose={onClose} wide>
      {!views.length ? (
        <div className="form-stack">
          <p>
            You have not saved a view yet. Search or filter your library, then use the + beside
            Saved views.
          </p>
        </div>
      ) : (
        <div className="view-manager">
          <div className="view-list">
            {views.map((v) => (
              <button
                key={v.id}
                className={v.id === active ? 'active' : ''}
                onClick={() => setActive(v.id)}
              >
                {v.name}
              </button>
            ))}
          </div>
          {form && (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                await api.saveView(form, active);
                await onChanged();
              }}
            >
              <label>
                Name
                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Search expression
                <input
                  maxLength={2048}
                  value={form.query}
                  onChange={(e) => setForm({ ...form, query: e.target.value })}
                  placeholder='design AND "case study"'
                />
              </label>
              <fieldset>
                <legend>Required tags (all must match)</legend>
                <div className="tag-checks">
                  {tags.map((t) => (
                    <label key={t.id}>
                      <input
                        type="checkbox"
                        checked={form.tagIds.includes(t.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tagIds: e.target.checked
                              ? [...form.tagIds, t.id]
                              : form.tagIds.filter((id: string) => id !== t.id),
                          })
                        }
                      />
                      #{t.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <footer className="modal-actions split">
                <button
                  type="button"
                  className="danger-text"
                  onClick={async () => {
                    if (confirm(`Delete saved view “${form.name}”?`)) {
                      await api.deleteView(active);
                      await onChanged();
                      const remaining = views.filter((v) => v.id !== active);
                      if (!remaining.length) onClose();
                      else setActive(remaining[0].id);
                    }
                  }}
                >
                  Delete view
                </button>
                <span />
                <button type="button" className="secondary" onClick={onClose}>
                  Close
                </button>
                <button className="primary">Save changes</button>
              </footer>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function App() {
  const [section, setSection] = useState<Section>('library'),
    [bookmarks, setBookmarks] = useState<Bookmark[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [tags, setTags] = useState<Tag[]>([]),
    [views, setViews] = useState<any[]>([]),
    [query, setQuery] = useState(''),
    [selectedTags, setSelectedTags] = useState<string[]>([]),
    [sort, setSort] = useState('created_at'),
    [direction, setDirection] = useState('desc'),
    [selected, setSelected] = useState(new Set<string>()),
    [saveOpen, setSaveOpen] = useState(false),
    [editing, setEditing] = useState<Bookmark | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [initialReady, setInitialReady] = useState(false),
    [notice, setNotice] = useState(''),
    [prefs, setPrefs] = useState<any>({
      defaultSort: 'created_at',
      sortDirection: 'desc',
      textSize: 'medium',
    }),
    [counts, setCounts] = useState({ active: 0, unread: 0, archived: 0 }),
    [saveViewOpen, setSaveViewOpen] = useState(false),
    [manageViews, setManageViews] = useState(false),
    [viewName, setViewName] = useState('');
  const scope = section === 'unread' ? 'unread' : section === 'archived' ? 'archived' : 'active';
  const refreshMeta = useCallback(async () => {
    const [tagData, viewData, a, u, r] = await Promise.all([
      api.tags(),
      api.views(),
      api.list({ scope: 'active', pageSize: '1' }),
      api.list({ scope: 'unread', pageSize: '1' }),
      api.list({ scope: 'archived', pageSize: '1' }),
    ]);
    setTags(tagData.items);
    setViews(viewData.items);
    setCounts({ active: a.total, unread: u.total, archived: r.total });
  }, []);
  const load = useCallback(
    async (silent = false) => {
      if (!['library', 'unread', 'archived'].includes(section)) return;
      if (!silent) setLoading(true);
      setError('');
      try {
        const data = await api.list({
          scope,
          q: query,
          tags: selectedTags.join(','),
          sort,
          direction,
          page: String(page),
          pageSize: '60',
        });
        setBookmarks(data.items);
        setTotal(data.total);
        await refreshMeta();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
        setInitialReady(true);
      }
    },
    [section, scope, query, selectedTags, sort, direction, page, refreshMeta],
  );
  useEffect(() => {
    api
      .preferences()
      .then((p) => {
        setPrefs(p);
        setSort(p.defaultSort);
        setDirection(p.sortDirection);
        document.documentElement.dataset.textSize = p.textSize;
        localStorage.setItem('textSize', p.textSize);
      })
      .catch(() => {});
    void refreshMeta();
  }, [refreshMeta]);
  useEffect(() => {
    const id = setTimeout(() => void load(), 180);
    return () => clearTimeout(id);
  }, [load]);
  useEffect(() => {
    if (bookmarks.some((b) => b.copyStatus === 'pending' || b.capturePending)) {
      const id = setInterval(() => void load(true), 2200);
      return () => clearInterval(id);
    }
  }, [bookmarks, load]);
  const changeSection = (next: Section) => {
    setSection(next);
    setSelected(new Set());
    setQuery('');
    setSelectedTags([]);
    setPage(1);
  };
  const action = async (b: Bookmark, action: string) => {
    try {
      if (action === 'read' || action === 'unread')
        await api.action(b.id, 'read', { read: action === 'read' });
      else await api.action(b.id, action);
      await load(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async (b: Bookmark) => {
    const copies = b.savedCopy ? 1 : 0;
    if (
      !confirm(
        `Permanently delete “${b.title}”?${copies ? ' Its saved copy will also be removed.' : ''} This cannot be undone.`,
      )
    )
      return;
    await api.remove(b.id, copies);
    setEditing(null);
    setNotice('Bookmark permanently deleted.');
    await load(true);
  };
  const bulk = async (action: string, data: any = {}) => {
    if (action === 'delete') {
      const expectedCopyCount = bookmarks.filter(
        (bookmark) => selected.has(bookmark.id) && bookmark.savedCopy,
      ).length;
      if (
        !confirm(
          `Permanently delete ${selected.size} bookmarks and ${expectedCopyCount} saved ${expectedCopyCount === 1 ? 'copy' : 'copies'}? This cannot be undone.`,
        )
      )
        return;
      data = { ...data, expectedCopyCount };
    }
    try {
      const result = await api.bulk([...selected], action, data);
      setNotice(
        result.failed
          ? `${result.succeeded} changed; ${result.failed} could not be changed.`
          : `${result.succeeded} bookmarks updated.`,
      );
      setSelected(new Set());
      await load(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const title =
    section === 'unread' ? 'Read later' : section === 'archived' ? 'Archive' : 'Your library';
  const subtitle =
    section === 'unread'
      ? 'Everything you still want to read, in one calm queue.'
      : section === 'archived'
        ? 'Bookmarks put away for safekeeping.'
        : 'A considered home for everything worth keeping.';
  const visibleCollection = ['library', 'unread', 'archived'].includes(section);
  return (
    <div className="app-shell" data-harness-ready={initialReady ? 'true' : undefined}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => changeSection('library')}>
          <span className="brand-mark">
            <Icon name="bookmark" />
          </span>
          <span>
            Keepsake<small>YOUR PRIVATE LIBRARY</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={section === 'library' ? 'active' : ''}
            onClick={() => changeSection('library')}
          >
            <Icon name="library" />
            <span>Library</span>
            <b>{counts.active}</b>
          </button>
          <button
            className={section === 'unread' ? 'active' : ''}
            onClick={() => changeSection('unread')}
          >
            <Icon name="unread" />
            <span>Read later</span>
            <b>{counts.unread}</b>
          </button>
          <button
            className={section === 'archived' ? 'active' : ''}
            onClick={() => changeSection('archived')}
          >
            <Icon name="archive" />
            <span>Archive</span>
            <b>{counts.archived}</b>
          </button>
        </nav>
        <div className="sidebar-section">
          <div>
            <span>SAVED VIEWS</span>
            <button aria-label="Save current view" onClick={() => setSaveViewOpen(true)}>
              +
            </button>
          </div>
          {views.length ? (
            views.map((v) => (
              <button
                key={v.id}
                className="saved-link"
                onClick={() => {
                  setSection('library');
                  setQuery(v.query);
                  setSelectedTags(
                    (v.tagIds ?? [])
                      .map((id: string) => tags.find((t) => t.id === id)?.name)
                      .filter(Boolean) as string[],
                  );
                }}
              >
                <Icon name="search" />
                <span>{v.name}</span>
              </button>
            ))
          ) : (
            <p>Save a search to find it here.</p>
          )}
          {views.length > 0 && (
            <button className="manage-views" onClick={() => setManageViews(true)}>
              Manage saved views
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <button
            className={section === 'portability' ? 'active' : ''}
            onClick={() => changeSection('portability')}
          >
            <Icon name="download" />
            Import & export
          </button>
          <button
            className={section === 'settings' ? 'active' : ''}
            onClick={() => changeSection('settings')}
          >
            <Icon name="settings" />
            Preferences
          </button>
          <div className="privacy">
            <span>◆</span>
            <div>
              <strong>Private by design</strong>
              <small>Your library stays on this device.</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="global-search">
            <Icon name="search" />
            <input
              aria-label="Search bookmarks"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              disabled={!visibleCollection}
              placeholder='Search words, "exact phrases", #tags…'
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search">
                ×
              </button>
            )}
            <kbd>⌘ K</kbd>
          </div>
          <button className="primary save-button" onClick={() => setSaveOpen(true)}>
            <Icon name="plus" />
            Save bookmark
          </button>
        </header>
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}
        {visibleCollection ? (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {section === 'library'
                    ? 'Collected with intention'
                    : section === 'unread'
                      ? 'Your reading queue'
                      : 'Safe, but out of the way'}
                </span>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              <div className="heading-stat">
                <strong>{total}</strong>
                <span>{total === 1 ? 'bookmark' : 'bookmarks'}</span>
              </div>
            </div>
            <div className="controls">
              <div className="filter-tags">
                <button
                  className={!selectedTags.length ? 'active' : ''}
                  onClick={() => {
                    setSelectedTags([]);
                    setPage(1);
                  }}
                >
                  All
                </button>
                {tags.map((t) => (
                  <button
                    key={t.id}
                    className={selectedTags.includes(t.name) ? 'active' : ''}
                    onClick={() => {
                      setPage(1);
                      setSelectedTags((s) =>
                        s.includes(t.name) ? s.filter((x) => x !== t.name) : [...s, t.name],
                      )
                    }}
                  >
                    #{t.name}
                  </button>
                ))}
              </div>
              <div className="sort-control">
                <span>Sort</span>
                <select
                  value={`${sort}:${direction}`}
                  onChange={(e) => {
                    const [s, d] = e.target.value.split(':');
                    setSort(s!);
                    setDirection(d!);
                    setPage(1);
                  }}
                >
                  <option value="created_at:desc">Newest saved</option>
                  <option value="created_at:asc">Oldest saved</option>
                  <option value="updated_at:desc">Recently updated</option>
                  <option value="title:asc">Title A–Z</option>
                  <option value="title:desc">Title Z–A</option>
                </select>
              </div>
            </div>
            <details className="search-help">
              <summary>Search tips</summary>
              <p>
                Words are combined automatically. Use <code>"exact phrases"</code>,{' '}
                <code>#tags</code>, uppercase <code>AND</code>, <code>OR</code>, <code>NOT</code>, a
                minus sign to exclude, and parentheses to group conditions.
              </p>
            </details>
            {error && (
              <div className="alert error search-error">
                <strong>Search needs a small fix.</strong> {error}
                <button onClick={() => setError('')}>Dismiss</button>
              </div>
            )}
            {bookmarks.length > 0 && (
              <div className="selection-row">
                <label>
                  <input
                    type="checkbox"
                    checked={bookmarks.every((b) => selected.has(b.id))}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(bookmarks.map((b) => b.id)) : new Set(),
                      )
                    }
                  />{' '}
                  Select all visible
                </label>
                <span>
                  {total} result{total === 1 ? '' : 's'}
                </span>
              </div>
            )}
            {loading ? (
              <div className="loading-grid">
                {[1, 2, 3, 4].map((x) => (
                  <div key={x} />
                ))}
              </div>
            ) : bookmarks.length ? (
              <div className="bookmark-grid">
                {bookmarks.map((b) => (
                  <BookmarkCard
                    key={b.id}
                    bookmark={b}
                    selected={selected.has(b.id)}
                    onSelect={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(b.id)) n.delete(b.id);
                        else n.add(b.id);
                        return n;
                      })
                    }
                    onOpen={() => setEditing(b)}
                    onAction={(a) => void action(b, a)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <Icon
                    name={
                      section === 'archived'
                        ? 'archive'
                        : section === 'unread'
                          ? 'unread'
                          : 'bookmark'
                    }
                  />
                </div>
                <h2>
                  {query || selectedTags.length
                    ? 'No bookmarks match that search'
                    : section === 'unread'
                      ? 'Your reading queue is clear'
                      : section === 'archived'
                        ? 'Nothing is archived'
                        : 'Your library is ready'}
                </h2>
                <p>
                  {query
                    ? 'Try fewer words, remove a filter, or check your search operators.'
                    : section === 'library'
                      ? 'Save your first link and Keepsake will fill in its details and make a readable copy.'
                      : section === 'unread'
                        ? 'New bookmarks begin here until you mark them read.'
                        : 'Archived bookmarks will stay here with their notes and saved copies.'}
                </p>
                {section === 'library' && !query && (
                  <button className="primary" onClick={() => setSaveOpen(true)}>
                    <Icon name="plus" />
                    Save your first bookmark
                  </button>
                )}
              </div>
            )}
            {total > 60 && (
              <nav className="pagination" aria-label="Collection pages">
                <button
                  className="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.ceil(total / 60)}
                </span>
                <button
                  className="secondary"
                  disabled={page >= Math.ceil(total / 60)}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        ) : section === 'saved' ? (
          <div />
        ) : section === 'portability' ? (
          <Portability
            onImported={() => {
              void refreshMeta();
              setNotice('Import complete. Saved copies are being prepared.');
            }}
          />
        ) : (
          <Preferences
            value={prefs}
            onSave={(p) => {
              setPrefs(p);
              setSort(p.defaultSort);
              setDirection(p.sortDirection);
              setNotice('Preferences saved.');
            }}
          />
        )}
      </main>
      {selected.size > 0 && (
        <div className="bulk-bar">
          <strong>{selected.size} selected</strong>
          <button onClick={() => void bulk('read')}>Mark read</button>
          <button onClick={() => void bulk('unread')}>Mark unread</button>
          <button
            onClick={() => {
              const value = prompt('Tags to add, separated by commas');
              if (value) void bulk('addTags', { tags: value.split(',') });
            }}
          >
            Add tags
          </button>
          <button
            onClick={() => {
              const value = prompt('Tags to remove, separated by commas');
              if (value) void bulk('removeTags', { tags: value.split(',') });
            }}
          >
            Remove tags
          </button>
          {section === 'archived' ? (
            <button onClick={() => void bulk('restore')}>Restore</button>
          ) : (
            <button onClick={() => void bulk('archive')}>Archive</button>
          )}
          <button className="danger-text" onClick={() => void bulk('delete')}>
            Delete
          </button>
          <button
            className="icon-button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
          >
            ×
          </button>
        </div>
      )}
      {saveOpen && (
        <SaveBookmark
          onClose={() => setSaveOpen(false)}
          onSaved={() => {
            setSaveOpen(false);
            setNotice('Bookmark saved. A readable copy is being prepared.');
            void load(true);
          }}
        />
      )}
      {editing && (
        <BookmarkEditor
          bookmark={editing}
          onClose={() => setEditing(null)}
          onChanged={(b) => {
            if (b) setEditing(b);
            void load(true);
          }}
          onDelete={() => void remove(editing)}
        />
      )}{' '}
      {saveViewOpen && (
        <Modal title="Save this view" onClose={() => setSaveViewOpen(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await api.saveView({
                name: viewName,
                query,
                tagIds: tags.filter((t) => selectedTags.includes(t.name)).map((t) => t.id),
              });
              setSaveViewOpen(false);
              setViewName('');
              await refreshMeta();
              setNotice('Saved view added to the sidebar.');
            }}
          >
            <p>
              Keep this search and its tag filters for quick access. Results always reflect your
              current library.
            </p>
            <label>
              Name
              <input
                autoFocus
                required
                maxLength={100}
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Weekend reading"
              />
            </label>
            <div className="saved-criteria">
              <strong>Search</strong>
              <span>{query || 'Any words'}</span>
              <strong>Tags</strong>
              <span>
                {selectedTags.length ? selectedTags.map((t) => `#${t}`).join(' + ') : 'Any tags'}
              </span>
            </div>
            <footer className="modal-actions">
              <button type="button" className="secondary" onClick={() => setSaveViewOpen(false)}>
                Cancel
              </button>
              <button className="primary">Save view</button>
            </footer>
          </form>
        </Modal>
      )}
      {manageViews && (
        <SavedViewManager
          views={views}
          tags={tags}
          onClose={() => setManageViews(false)}
          onChanged={async () => {
            await refreshMeta();
            setNotice('Saved view updated.');
          }}
        />
      )}
    </div>
  );
}
