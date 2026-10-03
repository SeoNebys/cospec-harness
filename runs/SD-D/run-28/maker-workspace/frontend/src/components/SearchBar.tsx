import { useState, useEffect } from 'react';

interface Props {
  value: string;
  onSubmit: (q: string) => void;
  error?: string;
}

/** Advanced-search input. Submits on Enter; shows malformed-query errors. */
export function SearchBar({ value, onSubmit, error }: Props) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <input
        type="text"
        placeholder='Search… (e.g. #work AND ("q3 report" OR budget) NOT draft)'
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(text);
        }}
      />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
