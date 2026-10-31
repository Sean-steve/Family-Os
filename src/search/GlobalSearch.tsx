import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from "react";
import {ArrowRight,BookOpen,ChevronRight,Info,LockKeyhole,Search,ShieldCheck,X} from "lucide-react";
import type {AppData} from "../data";
import {
  buildSearchIndex,locationFromSearch,privacyBoundaryText,searchGroups,searchIndex,
  type SearchArea,type SearchEntry
} from "./model";
import "./search.css";
type SearchProps={
  data:AppData;mode?:"page"|"modal";initialQuery?:string;
  onSelect:(entry:SearchEntry)=>void;onClose?:()=>void;
};
const filters:(SearchArea|"All")[]=["All","Navigation","Responsibilities","Calendar","Goals"];
export default function GlobalSearch({data,mode="page",initialQuery="",onSelect,onClose}:SearchProps){
  const [query,setQuery]=useState(initialQuery);
  const [area,setArea]=useState<SearchArea|"All">("All");
  const [activeIndex,setActiveIndex]=useState(-1);
  const inputRef=useRef<HTMLInputElement>(null);
  const resultRef=useRef<HTMLButtonElement[]>([]);
  const index=useMemo(()=>buildSearchIndex(data),[data]);
  const results=useMemo(()=>searchIndex(index,query,area,40),[index,query,area]);
  const groups=useMemo(()=>searchGroups(results),[results]);
  const display=(mode==="modal"?"Search dialog":"Cross-module search");
  useEffect(()=>{if(mode==="modal")inputRef.current?.focus();},[mode]);
  useEffect(()=>{setActiveIndex(-1);resultRef.current=[];},[query,area]);
  function handleKeyboard(event:KeyboardEvent<HTMLElement>){
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      event.preventDefault();
      const delta=event.key==="ArrowDown"?1:-1;
      setActiveIndex(current=>{
        const next=results.length?Math.max(0,Math.min(results.length-1,current+delta)):-1;
        resultRef.current[next]?.focus();return next;
      });
    }else if(event.key==="Enter"&&event.target===inputRef.current&&results.length){
      event.preventDefault();onSelect(results[activeIndex<0?0:activeIndex]);
    }else if(event.key==="Escape"&&mode==="modal"){event.preventDefault();onClose?.();}
  }
  const ordered=results.map((item,i)=>({item,i}));
  const content=<>
    <header className="se-header"><div><span><ShieldCheck size={15}/> FAMILY OS · PRIVACY-BOUND SEARCH</span>
      <h1>{mode==="modal"?"Search your Family OS":"Find your next destination"}</h1>
      <p>Find family workspaces and explicitly labelled shared tasks, events and goals without indexing personal records.</p></div>
      {mode==="modal"&&<button className="se-close" aria-label="Close search" onClick={onClose}><X size={20}/></button>}</header>
    <div className="se-input-wrap"><Search size={20}/><input ref={inputRef} role="combobox" aria-expanded={true} aria-haspopup="listbox"
      aria-controls="family-search-results" aria-autocomplete="list"
      aria-activedescendant={activeIndex>=0?"search-result-"+activeIndex:undefined}
      aria-label="Search family workspaces and shared records"
      placeholder="Search workspaces, goals, shared responsibilities..." value={query}
      onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>{
        setQuery("");inputRef.current?.focus();}}><X size={17}/></button>}</div>
    <nav className="se-filter-tabs" aria-label="Filter search results">{filters.map(f=><button key={f}
      type="button" aria-pressed={area===f} className={area===f?"active":""} onClick={()=>{setArea(f);inputRef.current?.focus();}}>
      {f}</button>)}</nav>
    <div className="se-result-status" role="status" aria-live="polite">{results.length} {query.trim()?"matching":"available"} results
      <span>{mode==="modal"?"↑ / ↓ choose · Enter open · Esc close":"Select a result to open its source workspace"}</span></div>
    <div className="se-results" id="family-search-results" role="listbox" aria-label="Search results">
      {groups.map(group=><div className="se-group" key={group.area} role="group" aria-label={group.area}>
        <h2>{group.area}</h2>{group.items.map(entry=>{
          const matched=ordered.find(x=>x.item.id===entry.id);const indexValue=matched?.i??0;
          return <button key={entry.id} id={"search-result-"+indexValue} type="button"
            role="option" aria-selected={activeIndex===indexValue} title={entry.accessibilityNote}
            ref={node=>{if(node)resultRef.current[indexValue]=node;}}
            onFocus={()=>setActiveIndex(indexValue)} onClick={()=>onSelect(entry)} className="se-result">
            <span className="se-result-icon">{entry.kind==="WORKSPACE"?<ArrowRight size={18}/>:<BookOpen size={17}/>}</span>
            <span className="se-result-copy"><strong>{entry.title}</strong><small>{entry.subtitle}</small></span>
            <span className="se-result-kind">{entry.kind==="WORKSPACE"?"Workspace":"Shared record"}</span><ChevronRight size={17}/>
          </button>;
        })}</div>)}
      {!results.length&&<div className="se-empty"><Info size={26}/><h2>No matching shared records or workspaces</h2>
        <p>Private records are not indexed here. Open a specific module to search its contents, or try another keyword.</p></div>}
    </div>
    <div className="se-privacy"><LockKeyhole size={18}/><div><strong>Privacy limitation</strong><p>{privacyBoundaryText}</p>
      <p>Each result opens its source workspace; private and legacy records are not globally indexed.
        The public prototype does not grant permission to view anyone else's records.</p></div></div>
    <footer className="se-footer"><span>Search uses this browser only · No external search API</span>
      <span>Searchable: workspaces, shared responsibilities, dated shared calendar entries and family goals</span></footer>
  </>;
  return mode==="modal"?
    <section className="se-shell se-modal" role="dialog" aria-modal="true" aria-label={display}
      onKeyDown={handleKeyboard}>{content}</section>:
    <main className="se-page" aria-label={display} onKeyDown={handleKeyboard}>
      <div className="se-breadcrumb">Family OS <ChevronRight size={14}/> Search</div>
      <section className="se-shell">{content}</section></main>;
}
export {locationFromSearch};
