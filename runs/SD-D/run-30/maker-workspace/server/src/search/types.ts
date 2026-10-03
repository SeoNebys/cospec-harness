export type Atom={kind:'word'|'phrase'|'tag';value:string;negated:boolean};
export type QueryAst=Atom[][];
