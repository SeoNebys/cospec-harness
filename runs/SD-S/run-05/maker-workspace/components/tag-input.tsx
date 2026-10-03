export function TagInput({value,onChange}:{value:string;onChange:(value:string)=>void}){
  return <div className="field"><label htmlFor="tags">Tags <span>Separate with commas</span></label><input id="tags" value={value} onChange={e=>onChange(e.target.value)} placeholder="design, research, weekend" maxLength={820}/></div>;
}
