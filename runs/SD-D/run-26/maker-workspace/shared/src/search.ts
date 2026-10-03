export type SourceSpan = { start: number; end: number };
export type SearchNode =
  | { type: 'text' | 'phrase' | 'tag'; value: string; span: SourceSpan }
  | { type: 'not'; child: SearchNode; span: SourceSpan }
  | { type: 'and' | 'or'; left: SearchNode; right: SearchNode; span: SourceSpan };

export type QueryIssue = { message: string; start: number; end: number; suggestion?: string };
