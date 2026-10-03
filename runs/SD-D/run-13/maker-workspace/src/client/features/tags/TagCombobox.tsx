import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button,ComboBox,Input,Label,ListBox,ListBoxItem,Popover } from 'react-aria-components';
import { api } from '../../lib/api-client.js';
import { queryKeys } from '../../lib/query-keys.js';
import { TagList } from './TagList.js';

export function TagCombobox({ values,onChange }: { values:string[]; onChange:(values:string[])=>void }) {
  const [input,setInput] = useState('');
  const {data} = useQuery({queryKey:queryKeys.tags(input),queryFn:()=>api<{items:Array<{id:number;name:string}>}>(`/api/tags/suggestions?prefix=${encodeURIComponent(input)}`)});
  const add = (value:string) => { const clean=value.trim().replace(/\s+/gu,' '); if (clean && !values.some((item)=>item.localeCompare(clean,undefined,{sensitivity:'accent'})===0) && values.length<20) onChange([...values,clean]); setInput(''); };
  return <div className="tag-control"><TagList values={values} onRemove={tag=>onChange(values.filter(item=>item!==tag))}/>
    <ComboBox inputValue={input} onInputChange={setInput} menuTrigger="input" allowsCustomValue allowsEmptyCollection onSelectionChange={key=>{const selected=data?.items.find(tag=>String(tag.id)===String(key));if(selected)add(selected.name);}}><Label>Tags <span className="hint">Type to reuse a tag, or press Enter to add</span></Label><div className="combo-input"><Input placeholder="e.g. research" onKeyDown={event=>{if((event.key==='Enter'||event.key===',')&&input){event.preventDefault();add(input);}}}/><Button aria-label="Show tag suggestions">⌄</Button></div><Popover className="combo-popover"><ListBox items={data?.items||[]}>{tag=><ListBoxItem id={String(tag.id)} textValue={tag.name}>{tag.name}</ListBoxItem>}</ListBox></Popover></ComboBox>
  </div>;
}
