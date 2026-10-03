import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createBookmark, previewMetadata } from '../../services/bookmarks-api.js';
import type { Bookmark, MetadataProposal } from '@shared/contracts.js';
export function SaveBookmarkForm({ onSaved }: { onSaved: (bookmark: Bookmark) => void }) {
  const [open, setOpen] = useState(false),
    [url, setUrl] = useState(''),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [note, setNote] = useState(''),
    [tags, setTags] = useState(''),
    [read, setRead] = useState(false),
    [proposal, setProposal] = useState<MetadataProposal | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    dirty = useRef({ title: false, description: false });
  useEffect(() => {
    if (!url.startsWith('http')) {
      setProposal(null);
      return;
    }
    const controller = new AbortController(),
      timer = setTimeout(() => {
        setStatus('Looking up page details…');
        previewMetadata(url, controller.signal)
          .then((p) => {
            setProposal(p);
            if (p.duplicate) {
              setStatus('Already saved.');
              return;
            }
            if (!dirty.current.title && p.title) setTitle(p.title);
            if (!dirty.current.description && p.description) setDescription(p.description);
            setStatus(p.message ?? 'Page details found.');
          })
          .catch((e) => {
            if (e.name !== 'AbortError') setStatus('Details unavailable — you can still save it.');
          });
      }, 550);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const b = await createBookmark({
        url,
        title: title.trim() || null,
        description: description.trim() || null,
        noteMarkdown: note,
        tags: tags
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        isRead: read,
        proposalToken: proposal?.proposalToken,
        acceptIcon: !!proposal?.iconUrl
      });
      onSaved(b);
      setUrl('');
      setTitle('');
      setDescription('');
      setNote('');
      setTags('');
      setProposal(null);
      dirty.current = { title: false, description: false };
      setOpen(false);
    } catch (e: any) {
      if (e.code === 'DUPLICATE' && e.details?.bookmark) {
        setStatus(`Already saved as “${e.details.bookmark.displayLabel}”.`);
      } else setStatus(e.message ?? 'Could not save. Your typing is still here.');
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <button className="primary add-button" onClick={() => setOpen(true)}>
        ＋ Save a link
      </button>
    );
  return (
    <section className="save-panel" aria-labelledby="save-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">New bookmark</p>
          <h2 id="save-heading">Save something worth returning to</h2>
        </div>
        <button className="icon-button" aria-label="Close save form" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      <form onSubmit={submit}>
        <label>
          Web address
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            required
            autoFocus
          />
        </label>
        {status && (
          <p className="status-line" role="status">
            {status}
          </p>
        )}
        {proposal?.duplicate && (
          <a className="inline-link" href={`/bookmarks/${proposal.duplicate.id}`}>
            Open the saved bookmark →
          </a>
        )}
        <div className="form-grid">
          <label>
            Title
            <input
              value={title}
              maxLength={300}
              onChange={(e) => {
                dirty.current.title = true;
                setTitle(e.target.value);
              }}
              placeholder="Filled in from the page when available"
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              maxLength={2000}
              onChange={(e) => {
                dirty.current.description = true;
                setDescription(e.target.value);
              }}
              rows={2}
            />
          </label>
        </div>
        <label>
          Personal note
          <textarea
            value={note}
            maxLength={50000}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Why are you saving this? Markdown is supported."
          />
        </label>
        <label>
          Tags
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="design, research, weekend"
          />
          <span className="field-hint">Separate tags with commas.</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
          I’ve already read this
        </label>
        {proposal?.iconUrl && (
          <div className="icon-proposal">
            <img src={proposal.iconUrl} alt="Proposed site icon" />
            <span>Site icon found</span>
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="quiet" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !!proposal?.duplicate}>
            {busy ? 'Saving…' : 'Save bookmark'}
          </button>
        </div>
      </form>
    </section>
  );
}
