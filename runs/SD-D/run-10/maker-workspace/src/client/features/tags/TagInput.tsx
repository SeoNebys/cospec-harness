import { useEffect, useState } from 'react';
import { api } from '../../app/api-client';

export type EditableTag = { id?: string; name: string };
export function TagInput({
  value,
  onChange,
}: {
  value: EditableTag[];
  onChange(value: EditableTag[]): void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void api
        .request<{
          items: Array<{ id: string; name: string }>;
        }>(`/api/tags?suggest=${encodeURIComponent(query)}&limit=8`)
        .then((result) => {
          setSuggestions(result.items);
          setActiveIndex(0);
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);
  const add = (tag: EditableTag) => {
    if (!value.some((item) => item.name.toLocaleLowerCase() === tag.name.toLocaleLowerCase()))
      onChange([...value, tag]);
    setQuery('');
  };
  const available = suggestions.filter((item) => !value.some((tag) => tag.id === item.id));
  const choices: EditableTag[] = [
    ...available,
    ...(!suggestions.some((tag) => tag.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase())
      ? [{ name: query.trim() }]
      : []),
  ];
  return (
    <div className="tag-input">
      <div className="tag-chips">
        {value.map((tag) => (
          <span className="chip" key={tag.id ?? tag.name}>
            {tag.name}
            <button
              type="button"
              aria-label={`Remove ${tag.name}`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        aria-label="Tags"
        value={query}
        placeholder="Add tags…"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && choices.length) {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % choices.length);
          }
          if (event.key === 'ArrowUp' && choices.length) {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + choices.length) % choices.length);
          }
          if (event.key === 'Escape') setQuery('');
          if (event.key === 'Enter' && query.trim()) {
            event.preventDefault();
            add(choices[activeIndex] ?? { name: query.trim() });
          }
        }}
        aria-controls={query ? 'tag-suggestions' : undefined}
        aria-activedescendant={query && choices.length ? `tag-suggestion-${activeIndex}` : undefined}
      />
      {query && (
        <div className="suggestion-list" role="listbox" id="tag-suggestions">
          {available.map((tag, index) => (
            <button
              id={`tag-suggestion-${index}`}
              aria-selected={activeIndex === index}
              type="button"
              role="option"
              key={tag.id}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => add(tag)}
            >
              #{tag.name}
            </button>
          ))}
          {!suggestions.some((tag) => tag.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase()) && (
            <button
              id={`tag-suggestion-${available.length}`}
              aria-selected={activeIndex === available.length}
              type="button"
              role="option"
              onMouseEnter={() => setActiveIndex(available.length)}
              onClick={() => add({ name: query.trim() })}
            >
              Create “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
