export type Ast=
  | {type:"term";value:string}
  | {type:"phrase";value:string}
  | {type:"tag";value:string}
  | {type:"not";child:Ast}
  | {type:"and";left:Ast;right:Ast}
  | {type:"or";left:Ast;right:Ast};
export class SearchSyntaxError extends Error { constructor(public code:string,public position:number,message:string){super(message);} }
type Token={kind:"word"|"phrase"|"and"|"or"|"not"|"open"|"close";value:string;at:number};

function tokenize(input:string) { const out:Token[]=[]; let i=0; while(i<input.length){if(/\s/.test(input[i])){i++;continue;} const at=i,c=input[i];if(input.slice(i,i+5).toLowerCase()==='tag:"'){i+=5;let value="";while(i<input.length&&input[i]!=='"')value+=input[i++];if(i===input.length)throw new SearchSyntaxError("UNTERMINATED_PHRASE",at,"Close the quoted tag.");i++;out.push({kind:"word",value:`tag:${value}`,at});continue;} if(c==="("){out.push({kind:"open",value:c,at});i++;continue;} if(c===")"){out.push({kind:"close",value:c,at});i++;continue;} if(c==='"'){i++;let value="";while(i<input.length&&input[i]!=='"')value+=input[i++];if(i===input.length)throw new SearchSyntaxError("UNTERMINATED_PHRASE",at,"Close the quoted phrase.");i++;out.push({kind:"phrase",value,at});continue;} let value="";while(i<input.length&&!/[\s()]/.test(input[i]))value+=input[i++];const upper=value.toUpperCase();const kind=upper==="AND"?"and":upper==="OR"?"or":upper==="NOT"?"not":"word";out.push({kind,value,at});} if(out.length>100)throw new SearchSyntaxError("TOO_MANY_TOKENS",0,"Use fewer search terms.");return out; }

export function parseSearch(input:string):Ast|null { if(input.length>2000)throw new SearchSyntaxError("QUERY_TOO_LONG",2000,"Shorten this search.");const tokens=tokenize(input);let p=0,depth=0;const peek=()=>tokens[p];const take=()=>tokens[p++];
 const primary=():Ast=>{const t=take();if(!t)throw new SearchSyntaxError("MISSING_OPERAND",input.length,"Add a search term.");if(t.kind==="open"){if(++depth>12)throw new SearchSyntaxError("NESTING_TOO_DEEP",t.at,"Use fewer nested groups.");const node=or();depth--;const end=take();if(!end||end.kind!=="close")throw new SearchSyntaxError("UNMATCHED_PARENTHESIS",t.at,"Close this parenthesis.");return node;}if(t.kind==="close")throw new SearchSyntaxError("UNMATCHED_PARENTHESIS",t.at,"Remove this unmatched parenthesis.");if(t.kind==="phrase")return{type:"phrase",value:t.value};if(t.kind==="word"){if(t.value.toLowerCase().startsWith("tag:")){let value=t.value.slice(4);if(!value&&peek()?.kind==="phrase")value=take().value;if(!value)throw new SearchSyntaxError("EMPTY_TAG",t.at,"Add a tag after tag:.");return{type:"tag",value};}return{type:"term",value:t.value};}throw new SearchSyntaxError("MISSING_OPERAND",t.at,"Add a search term.");};
 const unary=():Ast=>peek()?.kind==="not"?(take(),{type:"not",child:unary()}):primary();
 const and=():Ast=>{let node=unary();while(peek()&&peek().kind!=="or"&&peek().kind!=="close"){if(peek().kind==="and")take();node={type:"and",left:node,right:unary()};}return node;};
 const or=():Ast=>{let node=and();while(peek()?.kind==="or"){take();node={type:"or",left:node,right:and()};}return node;};
 if(!tokens.length)return null;const result=or();if(p<tokens.length)throw new SearchSyntaxError("UNMATCHED_PARENTHESIS",tokens[p].at,"Check the grouping in this search.");return result; }

export function formatSearch(ast:Ast|null):string { if(!ast)return"All bookmarks";if(ast.type==="term")return ast.value;if(ast.type==="phrase")return `“${ast.value}”`;if(ast.type==="tag")return `tag:${ast.value}`;if(ast.type==="not")return `NOT (${formatSearch(ast.child)})`;return `(${formatSearch(ast.left)} ${ast.type.toUpperCase()} ${formatSearch(ast.right)})`; }
