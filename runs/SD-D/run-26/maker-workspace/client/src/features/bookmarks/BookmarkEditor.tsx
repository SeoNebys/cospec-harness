import { useState, type FormEvent } from 'react';
import type { Bookmark, MetadataProposal } from '@shared/contracts.js';
import { refreshMetadata, updateBookmark } from '../../services/bookmarks-api.js';
import { NoteEditor } from './NoteEditor.js';
export function BookmarkEditor({
  bookmark,
  onSaved
}: {
  bookmark: Bookmark;
  onSaved: (b: Bookmark) => void;
}) {
  const [url, setUrl] = useState(bookmark.url),
    [title, setTitle] = useState(bookmark.title ?? ''),
    [description, setDescription] = useState(bookmark.description ?? ''),
    [note, setNote] = useState(bookmark.noteMarkdown),
    [tags, setTags] = useState(bookmark.tags.map((t) => t.name).join(', ')),
    [proposal, setProposal] = useState<MetadataProposal | null>(null),
    [acceptTitle, setAcceptTitle] = useState(false),
    [acceptDescription, setAcceptDescription] = useState(false),
    [acceptIcon, setAcceptIcon] = useState(false),
    [acceptedIconToken, setAcceptedIconToken] = useState<string | null>(null),
    [removeIcon, setRemoveIcon] = useState(false),
    [status, setStatus] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus('Saving…');
    try {
      const b = await updateBookmark(bookmark.id, {
        url,
        title: title || null,
        description: description || null,
        noteMarkdown: note,
        tags: tags
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        iconAssetToken: acceptedIconToken,
        removeIcon
      });
      onSaved(b);
      setStatus('Saved.');
    } catch (e: any) {
      setStatus(e.message);
    }
  }
  async function refresh() {
    setStatus('Checking the page…');
    try {
      const p = await refreshMetadata(bookmark.id);
      setProposal(p);
      setAcceptTitle(!bookmark.title && !!p.title);
      setAcceptDescription(!bookmark.description && !!p.description);
      setAcceptIcon(!bookmark.iconUrl && !!p.iconUrl);
      setStatus(p.message ?? 'Review the proposed changes below.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Page details could not be refreshed.');
    }
  }
  function apply() {
    if (!proposal) return;
    if (acceptTitle && proposal.title) setTitle(proposal.title);
    if (acceptDescription && proposal.description) setDescription(proposal.description);
    if (acceptIcon && proposal.proposalToken) {
      setAcceptedIconToken(proposal.proposalToken);
      setRemoveIcon(false);
      setStatus('Icon will be updated when you save.');
    }
    setProposal(null);
  }
  return (
    <form className="editor-form" onSubmit={submit}>
      <label>
        Web address
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
      </label>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
        />
      </label>
      <label>
        Tags
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <label>Personal note</label>
      <NoteEditor value={note} onChange={setNote} />
      {bookmark.iconUrl && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={removeIcon}
            onChange={(e) => {
              setRemoveIcon(e.target.checked);
              if (e.target.checked) setAcceptedIconToken(null);
            }}
          />
          Remove the saved site icon
        </label>
      )}
      <div className="refresh-row">
        <button type="button" onClick={() => void refresh()}>
          Refresh page details
        </button>
        <span>{status}</span>
      </div>
      {proposal && (
        <section className="proposal-diff">
          <h3>Choose what to use</h3>
          {proposal.title && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={acceptTitle}
                onChange={(e) => setAcceptTitle(e.target.checked)}
              />
              <span>
                <strong>Title</strong>
                <br />
                {proposal.title}
              </span>
            </label>
          )}
          {proposal.description && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={acceptDescription}
                onChange={(e) => setAcceptDescription(e.target.checked)}
              />
              <span>
                <strong>Description</strong>
                <br />
                {proposal.description}
              </span>
            </label>
          )}
          {proposal.iconUrl && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={acceptIcon}
                onChange={(e) => setAcceptIcon(e.target.checked)}
              />
              <span>Use refreshed site icon</span>
            </label>
          )}
          <button type="button" className="primary" onClick={apply}>
            Apply selected changes
          </button>
        </section>
      )}
      <button className="primary">Save changes</button>
    </form>
  );
}
