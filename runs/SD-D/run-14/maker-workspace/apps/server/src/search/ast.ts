export type SearchNode =
  | { type: 'term'|'phrase'|'tag'; value: string }
  | { type: 'not'; child: SearchNode }
  | { type: 'and'|'or'; left: SearchNode; right: SearchNode };
export interface SearchErrorShape { code: string; message: string; position: number; length: number }
export class SearchSyntaxError extends Error { constructor(public detail: SearchErrorShape) { super(detail.message); } }
