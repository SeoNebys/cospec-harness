import type { Preferences } from '../../../shared/api/types.js';
import { SearchHelp } from './SearchHelp.js';
import { SortControls } from './SortControls.js';

export function SearchControls({searchInput,onSearchInput,tag,favorite,sort,direction,onFilter,onSort,onClear,error}:{searchInput:string;onSearchInput:(value:string)=>void;tag:string;favorite:boolean;sort:string;direction:string;onFilter:(key:string,value:string)=>void;onSort:(value:Preferences)=>void;onClear:()=>void;error?:{message:string;start?:number;end?:number}|null}){
  return <div className="search-panel"><label className="search-label">Search bookmarks<input type="search" value={searchInput} onChange={event=>onSearchInput(event.target.value)} placeholder={'Try “design systems” AND tag:research'} aria-describedby={`search-help${error?' search-error':''}`} aria-invalid={Boolean(error)}/></label><SearchHelp/>{error&&<p id="search-error" className="search-error" role="alert">{error.message}{typeof error.start==='number'?` (near character ${error.start+1})`:''}</p>}
    <div className="filters"><label><input type="checkbox" checked={favorite} onChange={event=>onFilter('favorite',event.target.checked?'true':'')}/> Favorites only</label><label>Tag <input value={tag} onChange={event=>onFilter('tag',event.target.value)} placeholder="Exact tag"/></label><SortControls sort={sort} direction={direction} onChange={onSort}/>{(searchInput||tag||favorite)&&<button className="button quiet" onClick={onClear}>Clear filters</button>}</div></div>;
}
