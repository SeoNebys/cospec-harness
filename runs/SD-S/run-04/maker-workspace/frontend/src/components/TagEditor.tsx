import { useState } from "react";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/** Add/remove tags on a bookmark (FR-008). */
export function TagEditor({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const clean = draft.trim();
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      onChange([...tags, clean]);
    }
    setDraft("");
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div data-testid="tag-editor">
      <div className="card tags" style={{ border: "none", padding: 0, marginBottom: 8 }}>
        {tags.map((t) => (
          <span key={t} className="chip active">
            #{t}
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`Remove tag ${t}`}
              style={{ border: "none", background: "transparent", color: "#fff", padding: "0 2px" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="row">
        <input
          type="text"
          placeholder="Add a tag"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          data-testid="tag-editor-input"
        />
        <button type="button" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}
