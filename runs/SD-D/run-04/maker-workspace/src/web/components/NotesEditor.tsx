// Constrained rich-text notes editor (FR-003/FR-018). A plain textarea authored
// in a small Markdown subset — headings (#), bullet lists (-), links, and
// **bold**/*italic*. The formatted result is rendered (safely) on the card.

export function NotesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (notes: string) => void;
}) {
  return (
    <div className="notes-editor">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'A note… use # heading, - bullets, [text](https://link), **bold**'}
        rows={4}
      />
      <span className="notes-hint">
        Formatting: <code># Heading</code>, <code>- bullet</code>, <code>[text](https://…)</code>,{' '}
        <code>**bold**</code>, <code>*italic*</code>
      </span>
    </div>
  );
}
