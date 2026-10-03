import { useState, type ClipboardEvent, type FormEvent } from 'react';
import type { MetadataPreview } from '../../shared/types.js';
import { ApiClientError, createBookmark, previewMetadata, type BookmarkDraft } from '../api/client.js';

interface SaveBookmarkFormProps {
  onSaved: () => void | Promise<void>;
}

export function SaveBookmarkForm({ onSaved }: SaveBookmarkFormProps) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<MetadataPreview | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateDraft, setDuplicateDraft] = useState<BookmarkDraft | null>(null);

  async function lookup(value = url) {
    setLoading(true);
    setError('');
    setPreview(null);
    setDuplicateDraft(null);
    try {
      const result = await previewMetadata(value);
      setUrl(result.url);
      setPreview(result);
      setTitle(result.title);
      setDescription(result.description ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not check that address.');
    } finally {
      setLoading(false);
    }
  }

  function handleLookup(event: FormEvent) {
    event.preventDefault();
    void lookup();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').trim();
    if (/^https?:\/\//i.test(pasted)) {
      setUrl(pasted);
      window.setTimeout(() => void lookup(pasted), 0);
    }
  }

  function buildDraft(allowDuplicate = false): BookmarkDraft {
    return {
      url,
      title,
      description: description.trim() || null,
      tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      allowDuplicate,
    };
  }

  async function save(draft: BookmarkDraft) {
    setSaving(true);
    setError('');
    try {
      await createBookmark(draft);
      setUrl('');
      setPreview(null);
      setTitle('');
      setDescription('');
      setTagsText('');
      setDuplicateDraft(null);
      await onSaved();
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'DUPLICATE_URL') {
        setDuplicateDraft(draft);
      } else {
        setError(caught instanceof Error ? caught.message : 'The bookmark could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="save-panel" aria-labelledby="save-heading">
      <div className="section-kicker">Quick capture</div>
      <h2 id="save-heading">Save something worth returning to.</h2>
      <p className="section-intro">Paste a link. We’ll bring in the useful details; you stay in control.</p>

      <form className="url-form" onSubmit={handleLookup}>
        <label htmlFor="bookmark-url">Web address</label>
        <div className="url-row">
          <input
            id="bookmark-url"
            name="url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onPaste={handlePaste}
            placeholder="https://example.com/an-interesting-page"
            autoComplete="url"
            required
            disabled={loading || saving}
          />
          <button className="primary-button" type="submit" disabled={loading || saving || !url.trim()}>
            {loading ? 'Fetching details…' : 'Get page details'}
          </button>
        </div>
      </form>

      <div className="status-region" role="status" aria-live="polite">
        {loading ? 'Looking up the page title and description.' : ''}
      </div>
      {error ? <p className="message error-message" role="alert">{error}</p> : null}

      {preview ? (
        <form className="details-form" onSubmit={(event) => { event.preventDefault(); void save(buildDraft()); }}>
          {preview.warning ? <p className="message warning-message">{preview.warning}</p> : null}
          <div className="field-grid">
            <div className="field full-field">
              <label htmlFor="bookmark-title">Title</label>
              <input id="bookmark-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required />
            </div>
            <div className="field full-field">
              <label htmlFor="bookmark-description">Description <span>optional</span></label>
              <textarea id="bookmark-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} />
            </div>
            <div className="field full-field">
              <label htmlFor="bookmark-tags">Tags <span>optional, separated by commas</span></label>
              <input id="bookmark-tags" value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="research, design, weekend" />
            </div>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save bookmark'}</button>
            <button className="text-button" type="button" onClick={() => { setPreview(null); setDuplicateDraft(null); }}>Start over</button>
          </div>
          {duplicateDraft ? (
            <div className="duplicate-callout" role="alert">
              <strong>You already saved this address.</strong>
              <span>Keep the existing bookmark, or save another copy deliberately.</span>
              <div className="callout-actions">
                <button type="button" className="secondary-button" onClick={() => setDuplicateDraft(null)}>Cancel</button>
                <button type="button" className="primary-button" onClick={() => void save({ ...duplicateDraft, allowDuplicate: true })}>Save another copy</button>
              </div>
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
