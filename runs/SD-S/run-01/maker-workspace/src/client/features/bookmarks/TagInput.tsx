import { useState, type KeyboardEvent } from 'react';

interface TagInputProps { tags: string[]; onChange: (tags: string[]) => void; error?: string | undefined; }

export function TagInput({ tags, onChange, error }: TagInputProps) {
  const [draft, setDraft] = useState('');
  function addDraft() {
    const candidates = draft.split(',').map((tag) => tag.trim()).filter(Boolean);
    const existing = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
    const next = [...tags];
    for (const candidate of candidates) {
      if (!existing.has(candidate.toLocaleLowerCase()) && next.length < 20) { next.push(candidate); existing.add(candidate.toLocaleLowerCase()); }
    }
    onChange(next); setDraft('');
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addDraft(); }
  }
  return (
    <div className="field-group">
      <label htmlFor="bookmark-tags">Tags <span>Optional</span></label>
      <div className="tag-editor">
        {tags.map((tag) => <span className="tag-chip" key={tag.toLocaleLowerCase()}>{tag}<button type="button" aria-label={`Remove ${tag} tag`} onClick={() => onChange(tags.filter((item) => item !== tag))}>×</button></span>)}
        <input id="bookmark-tags" value={draft} maxLength={40} placeholder={tags.length ? 'Add another…' : 'research, design…'} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={addDraft} aria-describedby="tags-hint" aria-invalid={Boolean(error)} />
      </div>
      <small id="tags-hint">Press Enter or comma to add up to 20 tags.</small>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
