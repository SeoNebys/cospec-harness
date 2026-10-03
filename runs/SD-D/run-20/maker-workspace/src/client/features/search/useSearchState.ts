import { useEffect, useState } from 'react';
export function useSearchState(value: string, onChange: (value: string) => void) {
  const [state, setState] = useState({ external: value, input: value });
  if (value !== state.external) setState({ external: value, input: value });
  useEffect(() => {
    const timer = window.setTimeout(() => onChange(state.input), 250);
    return () => window.clearTimeout(timer);
  }, [state.input, onChange]);
  return {
    input: state.input,
    setInput: (input: string) => setState((current) => ({ ...current, input })),
  };
}
