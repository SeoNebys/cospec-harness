import { SearchSyntaxError } from './ast.js';
export type Token = { type: 'term'|'phrase'|'tag'|'not'|'or'|'lparen'|'rparen'|'eof'; value?: string; position: number; length: number };

export function tokenize(input: string): Token[] {
  const chars=[...input]; if(chars.length>2000) throw new SearchSyntaxError({code:'QUERY_TOO_LONG',message:'Search is longer than 2,000 characters.',position:2000,length:chars.length-2000});
  const out:Token[]=[]; let i=0;
  const pushWord=(type:'term'|'tag', start:number, seed='')=>{let v=seed; while(i<chars.length&&!/\s/.test(chars[i]!)&&!['(',')','"','#'].includes(chars[i]!)){if(chars[i]==='\\'){i++; if(i>=chars.length) throw new SearchSyntaxError({code:'INVALID_ESCAPE',message:'Escape must be followed by a character.',position:i-1,length:1});} v+=chars[i++]!;} if(!v) throw new SearchSyntaxError({code:'MISSING_OPERAND',message:'A tag name is required after #.',position:start,length:1}); if([...v].length>500) throw new SearchSyntaxError({code:'TOKEN_TOO_LONG',message:'Search term is longer than 500 characters.',position:start,length:i-start}); const upper=v.toUpperCase(); out.push(type==='term'&&upper==='OR'?{type:'or',position:start,length:i-start}:type==='term'&&upper==='NOT'?{type:'not',position:start,length:i-start}:{type,value:v,position:start,length:i-start});};
  while(i<chars.length){if(/\s/.test(chars[i]!)){i++;continue;} const start=i; const c=chars[i++]!; if(c==='(')out.push({type:'lparen',position:start,length:1}); else if(c===')')out.push({type:'rparen',position:start,length:1}); else if(c==='#')pushWord('tag',start); else if(c==='"'){let v='',closed=false; while(i<chars.length){const x=chars[i++]!; if(x==='"'){closed=true;break;} if(x==='\\'){if(i>=chars.length)break; v+=chars[i++]!;} else v+=x;} if(!closed)throw new SearchSyntaxError({code:'UNCLOSED_QUOTE',message:'Closing quotation mark is missing.',position:start,length:1}); if(!v)throw new SearchSyntaxError({code:'MISSING_OPERAND',message:'Quoted phrase cannot be empty.',position:start,length:i-start}); out.push({type:'phrase',value:v,position:start,length:i-start});} else {i--;pushWord('term',start);}
    if(out.length>256)throw new SearchSyntaxError({code:'TOO_MANY_TOKENS',message:'Search contains more than 256 tokens.',position:start,length:1});
  }
  out.push({type:'eof',position:chars.length,length:0}); return out;
}
