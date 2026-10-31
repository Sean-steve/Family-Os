import {useEffect,useMemo,useState,type FormEvent} from "react";
import {
  Album,Archive,ArrowRight,BookHeart,BookOpen,CalendarDays,Camera,Check,CheckCircle2,
  ChevronRight,Clock3,Compass,Edit3,Flag,Gift,Heart,History,Image,Info,Leaf,MapPin,
  Plus,Repeat2,Search,ShieldAlert,ShieldCheck,Sparkles,Star,TreePine,UsersRound,X
} from "lucide-react";
import type {AppData,Member} from "../data";
import {activeMembers} from "../family/model";
import {
  consentLabels,experienceAsCalendarEvent,experienceTypes,freshLifeId,legacyFromMemory,
  legacyKinds,lifeDate,lifeStats,memoryFromExperience,memoryFromTradition,nextTraditionDate,
  recordTraditionMoment,sortMemories,traditionCadences,validateExperience,validateLegacy,
  validateMemory,validateTradition,visibilityLabels
} from "./model";
import type {Experience,ExperienceStatus,ExperienceType,FamilyLifeState,LegacyKind,
  LegacyRecord,LifeVisibility,ConsentPreview,Memory,Tradition,TraditionCadence} from "./model";
import "./life.css";
type Tab="Experiences"|"Memories"|"Traditions"|"Legacy";
type Kind="Experience"|"Memory"|"Tradition"|"Legacy";
type Props={route:"Experiences"|"Memory"|"Traditions"|"Legacy";
  data:AppData;onChange:(fn:(prev:AppData)=>AppData)=>void;
  onToast:(message:string)=>void;navigate:(route:string)=>void};
const tabs:Tab[]=["Experiences","Memories","Traditions","Legacy"];
const week=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const month=["January","February","March","April","May","June","July","August","September","October","November","December"];
const today=lifeDate();
const memberLabel=(id:string,members:Member[])=>members.find(m=>m.id===id)?.name||"Unknown family member";
const fmtDate=(date:string)=>date?new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z")):"Date not set";
function People({ids,members}:{ids:string[];members:Member[]}){
  return <span className="lf-people" aria-label={ids.map(id=>memberLabel(id,members)).join(", ")}>
    {ids.slice(0,4).map(id=>{const m=members.find(x=>x.id===id);return m?
      <span key={id} title={m.name} style={{background:m.color}}>{m.name[0]}</span>:null})}
    {ids.length>4&&<span>+{ids.length-4}</span>}</span>;
}
function Heading({kicker,title,desc,action}:{kicker:string;title:string;desc:string;action?:React.ReactNode}){
  return <header className="lf-heading"><div><small>{kicker}</small><h2>{title}</h2><p>{desc}</p></div>{action}</header>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){
  return <label className="lf-field"><span>{label}</span>{children}</label>;
}
function Empty({title,desc,action}:{title:string;desc:string;action?:React.ReactNode}){
  return <div className="lf-empty"><Sparkles size={30}/><h3>{title}</h3><p>{desc}</p>{action}</div>;
}
function Picker({items,selected,change}:{items:Member[];selected:string[];change:(ids:string[])=>void}){
  return <div className="lf-picker">{items.map(m=><label className={selected.includes(m.id)?"selected":""} key={m.id}>
    <input type="checkbox" checked={selected.includes(m.id)} onChange={e=>
      change(e.target.checked?[...selected,m.id]:selected.filter(id=>id!==m.id))}/>{m.name}</label>)}</div>;
}
function blankExperience(householdId:string):Experience{return {
  id:freshLifeId("experience-"),title:"",summary:"",type:"TOGETHER",status:"IDEA",
  date:"",time:"",location:"",householdId,memberIds:[],linkedGoalId:"",linkedEventId:"",
  notes:"",createdAt:today,archived:false};
}
function blankMemory():Memory{return {id:freshLifeId("memory-"),title:"",story:"",date:today,
  experienceId:"",traditionId:"",memberIds:[],tags:[],visibility:"REVIEW_FIRST",
  consent:"NOT_RECORDED",status:"DRAFT",createdAt:today,mediaCaption:"",mediaKind:"NONE"};}
function blankTradition(householdId:string):Tradition{return {id:freshLifeId("tradition-"),title:"",
  meaning:"",cadence:"YEARLY",month:10,day:31,weekday:6,householdId,memberIds:[],
  active:true,moments:[],createdAt:today};}
function blankLegacy():LegacyRecord{return {id:freshLifeId("legacy-"),kind:"STORY",title:"",
  summary:"",content:"",custodianId:"",memberIds:[],linkedMemoryIds:[],
  visibility:"REVIEW_FIRST",status:"DRAFT",intendedRevealDate:"",createdAt:today,updatedAt:today};}
function experienceIcon(kind:ExperienceType){
  return kind==="TRAVEL"?<Compass size={24}/>:kind==="CELEBRATION"?<Gift size={24}/>:
    kind==="OUTDOORS"?<Leaf size={24}/>:kind==="LEARNING"?<BookOpen size={24}/>:<Heart size={24}/>;
}
function legacyIcon(kind:LegacyKind){
  return kind==="HEIRLOOM"?<Gift size={24}/>:kind==="WISDOM"?<Star size={24}/>:
    kind==="CAPSULE"?<Clock3 size={24}/>:kind==="LETTER"?<BookHeart size={24}/>:<BookOpen size={24}/>;
}
export default function FamilyLifeWorkspace({route,data,onChange,onToast,navigate}:Props){
  const tab:Tab=route==="Memory"?"Memories":route;
  const {life}=data;
  const members=activeMembers(data.members,data.family);
  const houses=data.family.households.filter(h=>h.status==="ACTIVE");
  const familyGoals=data.goals.filter(g=>g.status!=="ARCHIVED");
  const mainHome=houses.find(h=>h.isPrimary)?.id||houses[0]?.id||"";
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("ALL");
  const [archiveVisible,setArchiveVisible]=useState(false);
  const [editor,setEditor]=useState<Kind|null>(null);
  const [editId,setEditId]=useState<string|null>(null);
  const [expDraft,setExpDraft]=useState<Experience>(()=>blankExperience(""));
  const [memDraft,setMemDraft]=useState<Memory>(blankMemory);
  const [tradDraft,setTradDraft]=useState<Tradition>(()=>blankTradition(""));
  const [legacyDraft,setLegacyDraft]=useState<LegacyRecord>(blankLegacy);
  const [detail,setDetail]=useState<{kind:"Memory"|"Legacy"|"Tradition";id:string}|null>(null);
  const [momentDate,setMomentDate]=useState(today);
  const [momentNote,setMomentNote]=useState("");
  const [error,setError]=useState("");
  const stats=lifeStats(life);
  const liveExperiences=useMemo(()=>life.experiences.filter(e=>
    (archiveVisible||!e.archived)&&(filter==="ALL"||e.status===filter)&&
    (e.title+" "+e.summary+" "+e.location).toLowerCase().includes(query.toLowerCase()))
    .sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999")),[life.experiences,archiveVisible,filter,query]);
  const liveMemories=useMemo(()=>sortMemories(life.memories).filter(m=>
    (filter==="ALL"||m.status===filter)&&
    (m.title+" "+m.story+" "+m.tags.join(" ")).toLowerCase().includes(query.toLowerCase())),
    [life.memories,filter,query]);
  const archivedMemories=life.memories.filter(m=>m.status==="ARCHIVED"&&
    (m.title+" "+m.story).toLowerCase().includes(query.toLowerCase()));
  const allMemories=archiveVisible?[...liveMemories,...archivedMemories].sort((a,b)=>b.date.localeCompare(a.date)):liveMemories;
  const traditions=life.traditions.filter(t=>(archiveVisible||t.active)&&
    (t.title+" "+t.meaning).toLowerCase().includes(query.toLowerCase()));
  const legacies=life.legacy.filter(l=>(archiveVisible||l.status!=="ARCHIVED")&&
    (filter==="ALL"||l.kind===filter)&&
    (l.title+" "+l.summary+" "+l.content).toLowerCase().includes(query.toLowerCase()));
  const detailRecord=detail?(detail.kind==="Memory"?life.memories.find(x=>x.id===detail.id):
    detail.kind==="Tradition"?life.traditions.find(x=>x.id===detail.id):life.legacy.find(x=>x.id===detail.id)):null;
  const change=(fn:(prev:FamilyLifeState)=>FamilyLifeState)=>onChange(prev=>({...prev,life:fn(prev.life)}));
  const show=(next:Tab)=>{setFilter("ALL");setQuery("");setError("");navigate(next==="Memories"?"Memory":next);};
  const edit=(kind:Kind,id?:string,template?:Experience|Memory|Tradition|LegacyRecord)=>{
    setError("");setEditor(kind);setEditId(id||null);setDetail(null);
    if(kind==="Experience")setExpDraft(structuredClone(template as Experience||
      life.experiences.find(e=>e.id===id)||blankExperience(mainHome)));
    if(kind==="Memory")setMemDraft(structuredClone(template as Memory||
      life.memories.find(m=>m.id===id)||blankMemory()));
    if(kind==="Tradition")setTradDraft(structuredClone(template as Tradition||
      life.traditions.find(t=>t.id===id)||blankTradition(mainHome)));
    if(kind==="Legacy")setLegacyDraft(structuredClone(template as LegacyRecord||
      life.legacy.find(l=>l.id===id)||blankLegacy()));
  };
  const action=(kind:Kind,label:string)=><button className="lf-btn primary" onClick={()=>edit(kind)}><Plus size={16}/>{label}</button>;
  const patchExp=(p:Partial<Experience>)=>setExpDraft(d=>({...d,...p}));
  const patchMem=(p:Partial<Memory>)=>setMemDraft(d=>({...d,...p}));
  const patchTrad=(p:Partial<Tradition>)=>setTradDraft(d=>({...d,...p}));
  const patchLegacy=(p:Partial<LegacyRecord>)=>setLegacyDraft(d=>({...d,...p}));
  function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editor)return;
    let problem:string|null=null;
    const activeIds=members.map(m=>m.id);
    if(editor==="Experience"){
      problem=validateExperience(expDraft,activeIds,familyGoals.map(g=>g.id));
      if(!problem)change(prev=>({...prev,experiences:editId?prev.experiences.map(x=>
        x.id===editId?{...expDraft,title:expDraft.title.trim(),summary:expDraft.summary.trim()}:x):
        [{...expDraft,title:expDraft.title.trim(),summary:expDraft.summary.trim()},...prev.experiences]}));
    }else if(editor==="Memory"){
      problem=validateMemory(memDraft,activeIds,life);
      if(!problem)change(prev=>({...prev,memories:editId?prev.memories.map(x=>x.id===editId?{...memDraft,
        title:memDraft.title.trim(),story:memDraft.story.trim()}:x):[{...memDraft,
        title:memDraft.title.trim(),story:memDraft.story.trim()},...prev.memories]}));
    }else if(editor==="Tradition"){
      problem=validateTradition(tradDraft,activeIds);
      if(!problem)change(prev=>({...prev,traditions:editId?prev.traditions.map(x=>x.id===editId?{...tradDraft,
        title:tradDraft.title.trim(),meaning:tradDraft.meaning.trim()}:x):[{...tradDraft,
        title:tradDraft.title.trim(),meaning:tradDraft.meaning.trim()},...prev.traditions]}));
    }else{
      problem=validateLegacy(legacyDraft,activeIds,life);
      if(!problem)change(prev=>({...prev,legacy:editId?prev.legacy.map(x=>x.id===editId?{...legacyDraft,
        title:legacyDraft.title.trim(),content:legacyDraft.content.trim(),updatedAt:today}:x):
        [{...legacyDraft,title:legacyDraft.title.trim(),content:legacyDraft.content.trim(),updatedAt:today},...prev.legacy]}));
    }
    if(problem){setError(problem);return;}
    onToast((editId?"Updated ":"Created ")+editor.toLowerCase()+" in this browser");
    setEditor(null);
  }
  function archive(kind:Kind,id:string){
    if(kind==="Experience")change(p=>({...p,experiences:p.experiences.map(x=>x.id===id?{...x,archived:!x.archived}:x)}));
    if(kind==="Memory")change(p=>({...p,memories:p.memories.map(x=>x.id===id?{...x,
      status:x.status==="ARCHIVED"?"DRAFT":"ARCHIVED"}:x)}));
    if(kind==="Tradition")change(p=>({...p,traditions:p.traditions.map(x=>x.id===id?{...x,active:!x.active}:x)}));
    if(kind==="Legacy")change(p=>({...p,legacy:p.legacy.map(x=>x.id===id?{...x,
      status:x.status==="ARCHIVED"?"DRAFT":"ARCHIVED"}:x)}));
    setDetail(null);onToast("Archive state updated in browser preview");
  }
  function setExperienceStatus(exp:Experience,status:ExperienceStatus){
    change(p=>({...p,experiences:p.experiences.map(x=>x.id===exp.id?{...x,status}:x)}));
    onToast("Experience status updated");
  }
  function addCalendar(exp:Experience){
    if(exp.linkedEventId){
      onToast("Experience already has a linked calendar entry. Open Calendar to manage it.");
      navigate("Calendar");return;
    }
    try{
      const event=experienceAsCalendarEvent(exp);
      onChange(p=>({...p,events:[...p.events,event],life:{...p.life,
        experiences:p.life.experiences.map(x=>x.id===exp.id?{...x,linkedEventId:event.id}:x)}}));
      onToast("Added a dated event to Family Calendar. Future changes are managed there.");
    }catch(e){setError(e instanceof Error?e.message:"Add a valid experience date and time first.");}
  }
  function addMoment(t:Tradition){
    try{
      if(!momentNote.trim())throw new Error("Write a short note about this tradition moment.");
      const updated=recordTraditionMoment(t,momentDate,momentNote);
      change(p=>({...p,traditions:p.traditions.map(x=>x.id===t.id?updated:x)}));
      setMomentNote("");setError("");onToast("Tradition moment recorded in this browser");
    }catch(e){setError(e instanceof Error?e.message:"Could not record the moment.");}
  }
  useEffect(()=>{
    const handle=(e:KeyboardEvent)=>{if(e.key==="Escape"){setEditor(null);setDetail(null);setError("");}};
    window.addEventListener("keydown",handle);return ()=>window.removeEventListener("keydown",handle);
  },[]);
  return <main className="lf-workspace">
    <div className="lf-breadcrumb"><button onClick={()=>navigate("Dashboard")}>Dashboard</button><ChevronRight size={14}/>Family Life & Legacy</div>
    <section className="lf-hero">
      <div><span className="lf-eyebrow"><Sparkles size={15}/> THE STORY WE WRITE TOGETHER</span>
        <h1>Make moments matter. <em>Keep them close.</em></h1>
        <p>Plan experiences, capture meaningful moments, nurture traditions and preserve the stories that shape your family.</p>
        <div className="lf-hero-notes"><span><Heart size={15}/> Shared experiences</span><span><TreePine size={15}/> Living traditions</span><span><BookHeart size={15}/> Stories worth keeping</span></div>
      </div><div className="lf-hero-emblem"><Album size={48}/></div></section>
    <div className="lf-warning"><ShieldAlert size={18}/><span><strong>Fictional frontend preview — not private family storage.</strong>
      All text is unencrypted localStorage in this browser. Consent/visibility are labels only, not access controls.
      Do not enter real children's details, personal photos, identifying stories or confidential legacy records.</span></div>
    <div className="lf-stats">
      <button onClick={()=>show("Experiences")}><span className="lf-stat-icon peach"><Compass size={21}/></span>
        <strong>{stats.plannedExperiences}</strong><small>Experiences in planning</small></button>
      <button onClick={()=>show("Memories")}><span className="lf-stat-icon purple"><Camera size={21}/></span>
        <strong>{stats.recordedMemories}</strong><small>Recorded moments</small></button>
      <button onClick={()=>show("Traditions")}><span className="lf-stat-icon mint"><Repeat2 size={21}/></span>
        <strong>{stats.activeTraditions}</strong><small>Active traditions</small></button>
      <button onClick={()=>show("Legacy")}><span className="lf-stat-icon sky"><TreePine size={21}/></span>
        <strong>{stats.preservedLegacy}</strong><small>Saved legacy entries</small></button>
    </div>
    <nav className="lf-tabs" aria-label="Family life areas">{tabs.map(t=><button key={t} className={tab===t?"selected":""}
      aria-current={tab===t?"page":undefined} onClick={()=>show(t)}>
      {t==="Experiences"?<Compass size={17}/>:t==="Memories"?<Camera size={17}/>:t==="Traditions"?<Repeat2 size={17}/>:<TreePine size={17}/>}
      {t}</button>)}</nav>
    {tab==="Experiences"&&<>
      <Heading kicker="PLAN · EXPERIENCE · REMEMBER" title="Family Experiences"
        desc="Ideas, trips, celebrations and everyday adventures — all connected to the people who were there."
        action={action("Experience","Plan an Experience")}/>
      <div className="lf-filters"><label className="lf-search"><Search size={17}/><input aria-label="Search experiences"
        placeholder="Search family experiences..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label>Status <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All experiences</option>
          {(["IDEA","PLANNED","COMPLETED","CANCELLED"] as ExperienceStatus[]).map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        <label className="lf-checkline"><input type="checkbox" checked={archiveVisible} onChange={e=>setArchiveVisible(e.target.checked)}/> Include archived</label></div>
      <div className="lf-grid">{liveExperiences.map(exp=><article className="lf-experience-card" key={exp.id}>
        <div className={"lf-experience-art lf-art-"+exp.type.toLowerCase()}>
          <span className="lf-art-symbol">{experienceIcon(exp.type)}</span><span className="lf-type">{experienceTypes[exp.type]}</span></div>
        <div className="lf-card-content"><div className="lf-card-kicker"><span className={"lf-status status-"+exp.status.toLowerCase()}>{exp.status}</span>
          {exp.linkedEventId&&<span className="lf-linked"><CalendarDays size={13}/> Calendar link</span>}</div>
          <h3>{exp.title}</h3><p>{exp.summary||"A moment to look forward to together."}</p>
          <div className="lf-meta"><span><CalendarDays size={15}/>{fmtDate(exp.date)}</span>
            <span><MapPin size={15}/>{exp.location||"Location undecided"}</span></div>
          {exp.linkedGoalId&&<div className="lf-goal-note"><Flag size={14}/>{familyGoals.find(g=>g.id===exp.linkedGoalId)?.title||"Linked archived goal"}</div>}
          <div className="lf-card-footer"><People ids={exp.memberIds} members={members}/>
            <div><button onClick={()=>edit("Experience",exp.id)} aria-label={"Edit "+exp.title}><Edit3 size={16}/></button>
              <button onClick={()=>archive("Experience",exp.id)} aria-label={exp.archived?"Restore experience":"Archive experience"}><Archive size={16}/></button></div></div>
          <div className="lf-card-actions">
            {exp.status!=="COMPLETED"&&exp.status!=="CANCELLED"&&<button onClick={()=>setExperienceStatus(exp,"COMPLETED")}><CheckCircle2 size={15}/> Mark experienced</button>}
            {exp.status==="COMPLETED"&&<button onClick={()=>edit("Memory",undefined,memoryFromExperience(exp))}><Camera size={15}/> Capture memory</button>}
            {exp.status!=="CANCELLED"&&<button onClick={()=>addCalendar(exp)}><CalendarDays size={15}/>{exp.linkedEventId?"Open calendar":"Add to calendar"}</button>}
          </div></div></article>)}
        <button className="lf-new-card" onClick={()=>edit("Experience")}><Plus size={29}/><strong>Dream up an experience</strong>
          <small>Some of the best family memories start with a small plan.</small></button></div>
      {error&&<p className="lf-error" role="alert">{error}</p>}
      <div className="lf-integration"><Info size={17}/> Calendar entries are created only on request.
        An experience never silently creates a calendar event, and linked events are subsequently scheduled in the Calendar workspace.</div>
    </>}
    {tab==="Memories"&&<>
      <Heading kicker="FAMILY MEMORY TIMELINE" title="Moments worth remembering"
        desc="Stories, small joys and meaningful milestones — told in your family's own words."
        action={action("Memory","Capture a Memory")}/>
      <div className="lf-filters"><label className="lf-search"><Search size={17}/><input aria-label="Search memories"
        placeholder="Find a moment, story or tag..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label>View <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="ALL">All current memories</option><option value="DRAFT">Drafts</option><option value="RECORDED">Recorded</option></select></label>
        <label className="lf-checkline"><input type="checkbox" checked={archiveVisible} onChange={e=>setArchiveVisible(e.target.checked)}/> Show archived</label></div>
      <div className="lf-timeline">{allMemories.map(mem=><article className="lf-memory-card" key={mem.id}>
        <div className="lf-memory-date"><CalendarDays size={17}/><strong>{fmtDate(mem.date)}</strong><span className="lf-memory-timeline-node"/></div>
        <div className="lf-memory-body"><div className="lf-memory-cover"><Camera size={34}/>
          <span>{mem.mediaKind==="NONE"?"STORY MOMENT":"ILLUSTRATION PLACEHOLDER · NO PERSONAL PHOTO"}</span></div>
          <div className="lf-memory-copy"><div className="lf-card-kicker"><span className={"lf-status status-"+mem.status.toLowerCase()}>{mem.status}</span>
            <span className="lf-visibility"><ShieldCheck size={13}/>{visibilityLabels[mem.visibility]}</span></div>
            <h3>{mem.title}</h3><p>{mem.story}</p>
            <div className="lf-tag-row">{mem.tags.map(tag=><span key={tag}>#{tag}</span>)}</div>
            <div className="lf-privacy-status">{consentLabels[mem.consent]} · Not verified or enforced</div>
            {mem.mediaCaption&&<small className="lf-muted">{mem.mediaCaption}</small>}
            <div className="lf-card-footer"><People ids={mem.memberIds} members={members}/><div>
              <button aria-label={"Edit "+mem.title} onClick={()=>edit("Memory",mem.id)}><Edit3 size={16}/></button>
              <button aria-label={"Archive "+mem.title} onClick={()=>archive("Memory",mem.id)}><Archive size={16}/></button></div></div>
            <div className="lf-card-actions"><button onClick={()=>setDetail({kind:"Memory",id:mem.id})}>
              <BookOpen size={15}/> Read story</button>
              <button onClick={()=>edit("Legacy",undefined,legacyFromMemory(mem))}><TreePine size={15}/> Add to legacy</button></div>
          </div></div></article>)}
        {!allMemories.length&&<Empty title="Your timeline begins here"
          desc="Add a family memory or capture one from a completed experience." action={action("Memory","Capture memory")}/>}</div>
      <div className="lf-integration"><ShieldAlert size={17}/> "Recorded" is a local drafting status only.
        The application cannot verify participant consent or make these stories private.</div>
    </>}
    {tab==="Traditions"&&<>
      <Heading kicker="THE RHYTHMS THAT CONNECT US" title="Our Family Traditions"
        desc="The rituals, celebrations and routines that bring your family back together."
        action={action("Tradition","Create a Tradition")}/>
      <div className="lf-filters"><label className="lf-search"><Search size={17}/><input aria-label="Search traditions"
        placeholder="Search family traditions..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label className="lf-checkline"><input type="checkbox" checked={archiveVisible} onChange={e=>setArchiveVisible(e.target.checked)}/> Include paused traditions</label></div>
      <div className="lf-grid">{traditions.map(t=><article className="lf-tradition-card" key={t.id}>
        <div className="lf-tradition-top"><span className="lf-tradition-symbol"><Repeat2 size={24}/></span>
          <span className={"lf-status "+(t.active?"status-planned":"status-cancelled")}>{t.active?"ACTIVE":"PAUSED"}</span></div>
        <span className="lf-overline">{traditionCadences[t.cadence]} tradition</span>
        <h3>{t.title}</h3><p>{t.meaning}</p>
        <div className="lf-tradition-next"><CalendarDays size={16}/><span>{t.active?
          nextTraditionDate(t)?fmtDate(nextTraditionDate(t)||""):"Whenever it feels right":
          "Tradition paused"}</span></div>
        <div className="lf-tradition-moments"><div><span>Moments remembered</span><strong>{t.moments.length}</strong></div>
          {t.moments.slice(-2).reverse().map(m=><div key={m.id}><span>{fmtDate(m.date)}</span><small>{m.note}</small></div>)}
          {!t.moments.length&&<p className="lf-muted">No moments recorded yet.</p>}</div>
        <div className="lf-card-footer"><People ids={t.memberIds} members={members}/><div>
          <button onClick={()=>edit("Tradition",t.id)} aria-label={"Edit "+t.title}><Edit3 size={16}/></button>
          <button onClick={()=>archive("Tradition",t.id)} aria-label={t.active?"Pause tradition":"Resume tradition"}><Archive size={16}/></button></div></div>
        <div className="lf-card-actions"><button onClick={()=>{setDetail({kind:"Tradition",id:t.id});setMomentDate(today);setMomentNote("");setError("");}}>
          <History size={15}/> Record moment</button>
          <button onClick={()=>edit("Memory",undefined,memoryFromTradition(t))}><Camera size={15}/> Tell a story</button></div>
      </article>)}
      <button className="lf-new-card" onClick={()=>edit("Tradition")}><Plus size={29}/><strong>Start a tradition</strong>
        <small>Little rituals can become the moments people remember most.</small></button></div>
    </>}
    {tab==="Legacy"&&<>
      <Heading kicker="STORIES FOR THE NEXT GENERATION" title="Our Family Legacy"
        desc="Preserve family wisdom, meaningful objects, letters and the stories that deserve a future."
        action={action("Legacy","Add a Legacy Entry")}/>
      <div className="lf-legacy-note"><TreePine size={24}/><div><strong>Legacy is more than what we leave behind.</strong>
        <p>This preview lets you organise stories and intended recipients. Time-capsule dates are annotations only; access is not hidden, secured or scheduled.</p></div></div>
      <div className="lf-filters"><label className="lf-search"><Search size={17}/><input aria-label="Search legacy entries"
        placeholder="Search stories, wisdom and keepsakes..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label>Type <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All types</option>
          {(Object.keys(legacyKinds) as LegacyKind[]).map(k=><option key={k} value={k}>{legacyKinds[k]}</option>)}</select></label>
        <label className="lf-checkline"><input type="checkbox" checked={archiveVisible} onChange={e=>setArchiveVisible(e.target.checked)}/> Show archived</label></div>
      <div className="lf-grid">{legacies.map(record=><article className="lf-legacy-card" key={record.id}>
        <div className="lf-legacy-top"><span className="lf-legacy-symbol">{legacyIcon(record.kind)}</span>
          <span className={"lf-status status-"+record.status.toLowerCase()}>{record.status}</span></div>
        <span className="lf-overline">{legacyKinds[record.kind]}</span>
        <h3>{record.title}</h3><p>{record.summary||record.content.slice(0,125)}</p>
        <div className="lf-legacy-links"><span><BookHeart size={16}/>{record.linkedMemoryIds.length} related memories</span>
          {record.intendedRevealDate&&<span><Clock3 size={16}/> Intended date: {fmtDate(record.intendedRevealDate)}</span>}</div>
        <div className="lf-legacy-keeper"><ShieldCheck size={16}/> Custodian label: {record.custodianId?memberLabel(record.custodianId,members):"Unassigned"}
          <small> Not an access-control role</small></div>
        <div className="lf-card-footer"><People ids={record.memberIds} members={members}/><div>
          <button onClick={()=>edit("Legacy",record.id)} aria-label={"Edit "+record.title}><Edit3 size={16}/></button>
          <button onClick={()=>archive("Legacy",record.id)} aria-label={"Archive "+record.title}><Archive size={16}/></button></div></div>
        <div className="lf-card-actions"><button onClick={()=>setDetail({kind:"Legacy",id:record.id})}><BookOpen size={15}/> Read legacy entry</button></div>
      </article>)}
      <button className="lf-new-card" onClick={()=>edit("Legacy")}><Plus size={29}/><strong>Preserve a story</strong>
        <small>Keep a meaningful family lesson, letter or heirloom history close.</small></button></div>
    </>}

    {detail&&detailRecord&&<div className="lf-overlay" onClick={()=>{setDetail(null);setError("");}}><aside role="dialog"
      aria-modal="true" aria-label="Family life record" className="lf-drawer" onClick={e=>e.stopPropagation()}>
      <div className="lf-dialog-head"><small>FAMILY LIFE · LOCAL PREVIEW</small>
        <button aria-label="Close details" onClick={()=>{setDetail(null);setError("");}}><X size={20}/></button></div>
      <div className="lf-drawer-cover">{detail.kind==="Memory"?<Camera size={43}/>:detail.kind==="Tradition"?<Repeat2 size={43}/>:<TreePine size={43}/>}</div>
      {detail.kind==="Memory"&&"story" in detailRecord&&<div className="lf-drawer-body">
        <span className="lf-overline">{fmtDate(detailRecord.date)}</span><h2>{detailRecord.title}</h2><p>{detailRecord.story}</p>
        <div className="lf-privacy-note"><ShieldCheck size={17}/>{visibilityLabels[detailRecord.visibility]} · {consentLabels[detailRecord.consent]}</div>
        <h3>Participants</h3><People ids={detailRecord.memberIds} members={members}/>
        {detailRecord.experienceId&&<button className="lf-link" onClick={()=>show("Experiences")}>View linked experience <ArrowRight size={16}/></button>}
        {detailRecord.traditionId&&<button className="lf-link" onClick={()=>show("Traditions")}>View linked tradition <ArrowRight size={16}/></button>}
        <button className="lf-btn primary" onClick={()=>edit("Legacy",undefined,legacyFromMemory(detailRecord))}><TreePine size={17}/> Turn into legacy story</button>
      </div>}
      {detail.kind==="Legacy"&&"content" in detailRecord&&<div className="lf-drawer-body">
        <span className="lf-overline">{legacyKinds[detailRecord.kind]} · {detailRecord.status}</span><h2>{detailRecord.title}</h2>
        <p>{detailRecord.content}</p><div className="lf-privacy-note"><ShieldCheck size={17}/>{visibilityLabels[detailRecord.visibility]}</div>
        <h3>Linked family memories</h3>{detailRecord.linkedMemoryIds.map(id=>{
          const m=life.memories.find(x=>x.id===id);
          return m?<button className="lf-drawer-linked" key={id} onClick={()=>setDetail({kind:"Memory",id:m.id})}>
            <Camera size={15}/>{m.title}<ArrowRight size={15}/></button>:<p className="lf-muted" key={id}>A linked memory is no longer available.</p>;
        })}
        <p className="lf-muted">An intended reveal date does not hide this content; everyone with this browser can view it.</p>
        <button className="lf-btn primary" onClick={()=>edit("Legacy",detailRecord.id)}><Edit3 size={17}/> Edit entry</button>
      </div>}
      {detail.kind==="Tradition"&&"moments" in detailRecord&&<div className="lf-drawer-body">
        <span className="lf-overline">{traditionCadences[detailRecord.cadence]} tradition</span>
        <h2>{detailRecord.title}</h2><p>{detailRecord.meaning}</p>
        <h3>Record a moment</h3><label className="lf-field"><span>Date</span><input type="date" value={momentDate} onChange={e=>setMomentDate(e.target.value)}/></label>
        <label className="lf-field"><span>What made this moment meaningful?</span>
          <textarea rows={3} maxLength={450} value={momentNote} onChange={e=>setMomentNote(e.target.value)}/></label>
        <button className="lf-btn primary" onClick={()=>addMoment(detailRecord)}><Check size={16}/> Save moment</button>
        <h3>Tradition history</h3>{detailRecord.moments.slice().reverse().map(moment=>
          <div className="lf-history-item" key={moment.id}><strong>{fmtDate(moment.date)}</strong><p>{moment.note}</p></div>)}
        {error&&<p className="lf-error" role="alert">{error}</p>}
        {!detailRecord.moments.length&&<p className="lf-muted">Nothing recorded yet.</p>}
      </div>}
    </aside></div>}

    {editor&&<div className="lf-overlay lf-form-overlay" onClick={()=>{setEditor(null);setError("");}}>
      <section role="dialog" aria-modal="true" aria-label={editor+" editor"} className="lf-modal" onClick={e=>e.stopPropagation()}>
        <div className="lf-dialog-head"><div><small>FAMILY OS · LOCAL PREVIEW</small><h2>{editId?"Edit ":"Create "}{editor}</h2></div>
          <button aria-label="Close editor" onClick={()=>{setEditor(null);setError("");}}><X size={20}/></button></div>
        <form onSubmit={save}>
          {editor==="Experience"&&<><div className="lf-form-grid">
            <Field label="Experience name"><input autoFocus required maxLength={130} value={expDraft.title} onChange={e=>patchExp({title:e.target.value})}/></Field>
            <Field label="Type"><select value={expDraft.type} onChange={e=>patchExp({type:e.target.value as ExperienceType})}>
              {(Object.keys(experienceTypes) as ExperienceType[]).map(t=><option key={t} value={t}>{experienceTypes[t]}</option>)}</select></Field>
            <Field label="Stage"><select value={expDraft.status} onChange={e=>patchExp({status:e.target.value as ExperienceStatus})}>
              {(["IDEA","PLANNED","COMPLETED","CANCELLED"] as ExperienceStatus[]).map(s=><option key={s} value={s}>{s}</option>)}</select></Field>
            <Field label="Date"><input type="date" value={expDraft.date} onChange={e=>patchExp({date:e.target.value})}/></Field>
            <Field label="Time"><input type="time" value={expDraft.time} onChange={e=>patchExp({time:e.target.value})}/></Field>
            <Field label="General location"><input maxLength={120} value={expDraft.location} onChange={e=>patchExp({location:e.target.value})}/></Field>
            <Field label="Household"><select value={expDraft.householdId} onChange={e=>patchExp({householdId:e.target.value})}>
              <option value="">Whole family</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
            <Field label="Related strategy goal"><select value={expDraft.linkedGoalId} onChange={e=>patchExp({linkedGoalId:e.target.value})}>
              <option value="">No linked goal</option>{familyGoals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
            <Field label="What should we experience together?"><textarea rows={3} maxLength={550} value={expDraft.summary} onChange={e=>patchExp({summary:e.target.value})}/></Field>
            <Field label="Notes / planning ideas"><textarea rows={3} maxLength={550} value={expDraft.notes} onChange={e=>patchExp({notes:e.target.value})}/></Field>
          </div><div className="lf-form-label">People taking part</div><Picker items={members} selected={expDraft.memberIds}
            change={ids=>patchExp({memberIds:ids})}/></>}
          {editor==="Memory"&&<><div className="lf-form-grid">
            <Field label="Memory title"><input autoFocus required maxLength={130} value={memDraft.title} onChange={e=>patchMem({title:e.target.value})}/></Field>
            <Field label="Date remembered"><input type="date" required value={memDraft.date} onChange={e=>patchMem({date:e.target.value})}/></Field>
            <Field label="The story"><textarea required rows={5} maxLength={1500} value={memDraft.story} onChange={e=>patchMem({story:e.target.value})}/></Field>
            <Field label="Tags (comma separated)"><input maxLength={160} value={memDraft.tags.join(", ")}
              onChange={e=>patchMem({tags:e.target.value.split(",").map(v=>v.trim()).filter(Boolean).slice(0,8)})}/></Field>
            <Field label="Linked experience"><select value={memDraft.experienceId} onChange={e=>patchMem({experienceId:e.target.value})}>
              <option value="">No experience link</option>{life.experiences.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
            <Field label="Linked tradition"><select value={memDraft.traditionId} onChange={e=>patchMem({traditionId:e.target.value})}>
              <option value="">No tradition link</option>{life.traditions.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
            <Field label="Drafting status"><select value={memDraft.status} onChange={e=>patchMem({status:e.target.value as Memory["status"]})}>
              <option value="DRAFT">Draft only</option><option value="RECORDED">Recorded in browser (not shared securely)</option><option value="ARCHIVED">Archived</option></select></Field>
            <Field label="Visibility label — NOT security"><select value={memDraft.visibility} onChange={e=>patchMem({visibility:e.target.value as LifeVisibility})}>
              {(Object.keys(visibilityLabels) as LifeVisibility[]).map(v=><option key={v} value={v}>{visibilityLabels[v]}</option>)}</select></Field>
            <Field label="Consent review record — self-reported"><select value={memDraft.consent} onChange={e=>patchMem({consent:e.target.value as ConsentPreview})}>
              {(Object.keys(consentLabels) as ConsentPreview[]).map(v=><option key={v} value={v}>{consentLabels[v]}</option>)}</select></Field>
            <Field label="Media placeholder"><select value={memDraft.mediaKind} onChange={e=>patchMem({mediaKind:e.target.value as Memory["mediaKind"]})}>
              <option value="NONE">Story only</option><option value="PHOTO_PLACEHOLDER">Photo placeholder (no upload)</option>
              <option value="VIDEO_PLACEHOLDER">Video placeholder (no upload)</option></select></Field>
            <Field label="Illustration caption (not a file)"><input maxLength={160} value={memDraft.mediaCaption} onChange={e=>patchMem({mediaCaption:e.target.value})}/></Field>
          </div><div className="lf-form-label">People appearing in this memory</div><Picker items={members} selected={memDraft.memberIds}
            change={ids=>patchMem({memberIds:ids})}/>
          <p className="lf-safety-form"><ShieldAlert size={16}/> Consent and privacy labels are NOT verified, and no participant can authenticate or revoke them here. Use fictional memories only.</p></>}
          {editor==="Tradition"&&<><div className="lf-form-grid">
            <Field label="Tradition title"><input required autoFocus maxLength={130} value={tradDraft.title} onChange={e=>patchTrad({title:e.target.value})}/></Field>
            <Field label="Recurrence"><select value={tradDraft.cadence} onChange={e=>patchTrad({cadence:e.target.value as TraditionCadence})}>
              {(Object.keys(traditionCadences) as TraditionCadence[]).map(t=><option key={t} value={t}>{traditionCadences[t]}</option>)}</select></Field>
            <Field label="Why does it matter?"><textarea required rows={4} maxLength={700} value={tradDraft.meaning} onChange={e=>patchTrad({meaning:e.target.value})}/></Field>
            {tradDraft.cadence==="WEEKLY"&&<Field label="Day of week"><select value={tradDraft.weekday} onChange={e=>patchTrad({weekday:Number(e.target.value)})}>
              {week.map((d,i)=><option key={i} value={i}>{d}</option>)}</select></Field>}
            {(tradDraft.cadence==="YEARLY"||tradDraft.cadence==="MONTHLY")&&<Field label="Day of month"><input type="number" min={1} max={31}
              value={tradDraft.day} onChange={e=>patchTrad({day:Number(e.target.value)})}/></Field>}
            {tradDraft.cadence==="YEARLY"&&<Field label="Month"><select value={tradDraft.month} onChange={e=>patchTrad({month:Number(e.target.value)})}>
              {month.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></Field>}
            <Field label="Household"><select value={tradDraft.householdId} onChange={e=>patchTrad({householdId:e.target.value})}>
              <option value="">Whole family</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
            <Field label="Status"><select value={tradDraft.active?"ACTIVE":"PAUSED"} onChange={e=>patchTrad({active:e.target.value==="ACTIVE"})}>
              <option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></select></Field>
          </div><div className="lf-form-label">Who joins this tradition?</div><Picker items={members} selected={tradDraft.memberIds}
            change={ids=>patchTrad({memberIds:ids})}/></>}
          {editor==="Legacy"&&<><div className="lf-form-grid">
            <Field label="Legacy entry title"><input required autoFocus maxLength={130} value={legacyDraft.title}
              onChange={e=>patchLegacy({title:e.target.value})}/></Field>
            <Field label="Entry type"><select value={legacyDraft.kind} onChange={e=>patchLegacy({kind:e.target.value as LegacyKind})}>
              {(Object.keys(legacyKinds) as LegacyKind[]).map(k=><option key={k} value={k}>{legacyKinds[k]}</option>)}</select></Field>
            <Field label="One-line description"><input maxLength={250} value={legacyDraft.summary}
              onChange={e=>patchLegacy({summary:e.target.value})}/></Field>
            <Field label="Story / knowledge / letter"><textarea required rows={7} maxLength={2400} value={legacyDraft.content}
              onChange={e=>patchLegacy({content:e.target.value})}/></Field>
            <Field label="Custodian label (NOT access rights)"><select value={legacyDraft.custodianId} onChange={e=>patchLegacy({custodianId:e.target.value})}>
              <option value="">Not assigned</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            <Field label="Legacy drafting status"><select value={legacyDraft.status} onChange={e=>patchLegacy({status:e.target.value as LegacyRecord["status"]})}>
              <option value="DRAFT">Draft</option><option value="PRESERVED">Saved in browser (not backed up)</option><option value="ARCHIVED">Archived</option></select></Field>
            <Field label="Visibility label — not enforced"><select value={legacyDraft.visibility} onChange={e=>patchLegacy({visibility:e.target.value as LifeVisibility})}>
              {(Object.keys(visibilityLabels) as LifeVisibility[]).map(k=><option key={k} value={k}>{visibilityLabels[k]}</option>)}</select></Field>
            <Field label="Intended reveal date (not hidden)"><input type="date" value={legacyDraft.intendedRevealDate}
              onChange={e=>patchLegacy({intendedRevealDate:e.target.value})}/></Field>
          </div><div className="lf-form-label">People referenced in this entry</div><Picker items={members} selected={legacyDraft.memberIds}
            change={ids=>patchLegacy({memberIds:ids})}/>
          <div className="lf-form-label">Connected memories (links, not copies)</div>
          <div className="lf-memory-picker">{life.memories.filter(m=>m.status!=="ARCHIVED").map(mem=>
            <label key={mem.id}><input type="checkbox" checked={legacyDraft.linkedMemoryIds.includes(mem.id)}
              onChange={e=>patchLegacy({linkedMemoryIds:e.target.checked?[...legacyDraft.linkedMemoryIds,mem.id]:
                legacyDraft.linkedMemoryIds.filter(id=>id!==mem.id)})}/>{mem.title}</label>)}</div>
          <p className="lf-safety-form"><ShieldAlert size={16}/> Time capsules and "private" entries are fully readable in browser storage. No secure future release, heirloom transfer or protected access is provided.</p></>}
          {error&&<p className="lf-error" role="alert">{error}</p>}
          <div className="lf-modal-actions"><button type="button" className="lf-btn light" onClick={()=>setEditor(null)}>Cancel</button>
            <button type="submit" className="lf-btn primary"><Check size={16}/> Save {editor}</button></div>
        </form><div className="lf-disclaimer"><Info size={16}/> This is a UI prototype, not secure family memory storage.</div>
      </section></div>}
    <footer className="lf-footer">Family OS · Phase 6 — Experiences, Memories, Traditions & Legacy
      <span>Local-only interactive preview · No media upload or privacy enforcement</span></footer>
  </main>;
}
