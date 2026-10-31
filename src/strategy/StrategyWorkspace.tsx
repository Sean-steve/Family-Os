import {useEffect,useState,type FormEvent} from "react";
import {ArrowRight,Award,BookOpen,CalendarDays,Check,CheckCircle2,ChevronRight,Compass,Edit3,Flag,Heart,Info,Plus,Rocket,Search,ShieldCheck,Sparkles,Sprout,Target,TrendingUp,UsersRound,X} from "lucide-react";
import type {AppData,Goal,Member} from "../data";
import type { SearchEntry } from "../search/model";
import {activeMembers,freshId} from "../family/model";
import {clampProgress,goalHistoryLabel,missionProgress,milestoneProgress,objectiveProgress,overallProgress,recordGoalProgress,strategyToday,validParent} from "./model";
import type {FamilyValue,Mission,Milestone,Objective,StrategyReview,StrategyStatus} from "./model";
import "./strategy.css";

type Tab="Overview"|"Vision & Values"|"Missions"|"Milestones"|"Objectives"|"Goals"|"Reviews";
type Kind="Vision"|"Value"|"Mission"|"Milestone"|"Objective"|"Goal"|"Review"|"Progress";
type Props={data:AppData;onChange:(fn:(p:AppData)=>AppData)=>void;onToast:(s:string)=>void;navigate:(s:string)=>void;initialAction?:"Goal"|null;onInitialActionConsumed?:()=>void;searchFocus?:SearchEntry};
const tabs:Tab[]=["Overview","Vision & Values","Missions","Milestones","Objectives","Goals","Reviews"];
const statuses:StrategyStatus[]=["DRAFT","ACTIVE","PAUSED","COMPLETED","ARCHIVED"];
function Progress({value}:{value:number|null}){return <div className="st-track"><span style={{width:(value??0)+"%"}}/></div>}
function Status({value}:{value?:StrategyStatus}){return <span className={"st-status st-"+(value||"ACTIVE").toLowerCase()}>{value||"ACTIVE"}</span>}
function Heading({tag,title,description,action}:{tag:string;title:string;description:string;action?:React.ReactNode}){
  return <header className="st-heading"><div><small>{tag}</small><h2>{title}</h2><p>{description}</p></div>{action}</header>;
}
function MemberChips({ids,members}:{ids:string[];members:Member[]}){return <div className="st-members">{ids.map(id=>{
  const m=members.find(x=>x.id===id);return m?<span key={id} title={m.name} style={{background:m.color}}>{m.name[0]}</span>:null;
})}</div>}
function ValueIcon({symbol}:{symbol:string}){return symbol==="shield"?<ShieldCheck/>:symbol==="users"?<UsersRound/>:symbol==="sprout"?<Sprout/>:<Heart/>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="st-field"><span>{label}</span>{children}</label>}
export default function StrategyWorkspace({data,onChange,onToast,navigate,initialAction,onInitialActionConsumed,searchFocus}:Props){
  const {strategy,goals}=data;
  const members=activeMembers(data.members,data.family);
  const [tab,setTab]=useState<Tab>("Overview");
  const [editing,setEditing]=useState<{kind:Kind;id?:string}|null>(null);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [owners,setOwners]=useState<string[]>([]);
  const [links,setLinks]=useState<string[]>([]);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<"ALL"|StrategyStatus>("ALL");
  const [archived,setArchived]=useState(false);
  const [detail,setDetail]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  useEffect(()=>{
    if(searchFocus?.kind==="SHARED_RECORD"&&searchFocus.area==="Goals"){
      setTab("Goals");setQuery(searchFocus.title);setFilter("ALL");setArchived(false);
    }
  },[searchFocus]);
  const mission=(id:string)=>strategy.missions.find(x=>x.id===id);
  const milestone=(id:string)=>strategy.milestones.find(x=>x.id===id);
  const objective=(id:string)=>strategy.objectives.find(x=>x.id===id);
  const path=(objectiveId:string)=>{
    const o=objective(objectiveId),k=o?milestone(o.milestoneId):undefined;
    return [k?mission(k.missionId)?.title:"",k?.title,o?.title].filter(Boolean).join(" / ");
  };
  const activeValues=strategy.values.filter(x=>!x.archived).sort((a,b)=>a.priority-b.priority);
  const visibleValues=strategy.values.filter(x=>archived||!x.archived).sort((a,b)=>a.priority-b.priority);
  const visibleMissions=strategy.missions.filter(x=>archived||x.status!=="ARCHIVED");
  const visibleMilestones=strategy.milestones.filter(x=>archived||x.status!=="ARCHIVED");
  const visibleObjectives=strategy.objectives.filter(x=>archived||x.status!=="ARCHIVED");
  const visibleGoals=goals.filter(x=>(archived||x.status!=="ARCHIVED")&&(filter==="ALL"||(x.status||"ACTIVE")===filter)&&
    (x.title+" "+x.meta+" "+(x.description||"")).toLowerCase().includes(query.toLowerCase()));
  const progress=overallProgress(strategy,goals);
  const goalDetails=goals.find(x=>x.id===detail);
  const nextMilestone=visibleMilestones.filter(x=>x.targetDate&&x.targetDate>=strategyToday()&&x.status==="ACTIVE")
    .sort((a,b)=>a.targetDate.localeCompare(b.targetDate))[0];
  useEffect(()=>{if(initialAction==="Goal")open("Goal");if(initialAction)onInitialActionConsumed?.();
    // only fire on a new create request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[initialAction]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{if(e.key==="Escape"){setEditing(null);setDetail(null);}};
    window.addEventListener("keydown",handler);return ()=>window.removeEventListener("keydown",handler);
  },[]);
  const editField=(key:string,val:string)=>setDraft(p=>({...p,[key]:val}));
  const toggle=(items:string[],set:(p:string[])=>void,id:string)=>set(items.includes(id)?items.filter(v=>v!==id):[...items,id]);
  const change=(fn:(p:AppData)=>AppData)=>onChange(fn);
  const action=(kind:Kind,title:string,defaults:Record<string,string>={})=>
    <button className="st-btn primary" onClick={()=>open(kind,undefined,defaults)}><Plus size={16}/>{title}</button>;
  function open(kind:Kind,id?:string,defaults:Record<string,string>={}){
    const v=strategy.vision;
    const value=strategy.values.find(x=>x.id===id),m=mission(id||""),k=milestone(id||""),o=objective(id||""),g=goals.find(x=>x.id===id),
      r=strategy.reviews.find(x=>x.id===id);
    let d:Record<string,string>={title:"",description:"",status:"ACTIVE",targetDate:""};
    let own:string[]=[],val:string[]=[];
    if(kind==="Vision")d={title:v.title,statement:v.statement,horizon:v.horizon,status:v.status};
    if(kind==="Value")d={...d,title:value?.title||"",description:value?.description||"",symbol:value?.symbol||"heart",priority:String(value?.priority||strategy.values.length+1)};
    if(kind==="Mission"){d={...d,title:m?.title||"",description:m?.description||"",status:m?.status||"ACTIVE",targetDate:m?.targetDate||"",priority:m?.priority||"MEDIUM"};own=m?.ownerIds||[];val=m?.valueIds||[];}
    if(kind==="Milestone")d={...d,title:k?.title||"",description:k?.description||"",status:k?.status||"ACTIVE",targetDate:k?.targetDate||"",missionId:k?.missionId||strategy.missions.find(x=>x.status!=="ARCHIVED")?.id||""};
    if(kind==="Objective"){d={...d,title:o?.title||"",description:o?.description||"",status:o?.status||"ACTIVE",targetDate:o?.targetDate||"",milestoneId:o?.milestoneId||strategy.milestones.find(x=>x.status!=="ARCHIVED")?.id||"",metric:o?.metric||"",target:o?.target||""};own=o?.ownerIds||[];}
    if(kind==="Goal"){d={...d,title:g?.title||"",description:g?.description||"",status:g?.status||"ACTIVE",targetDate:g?.targetDate||"",meta:g?.meta||"Family priority",progress:String(g?.progress||0),objectiveId:g?.objectiveId||strategy.objectives.find(x=>x.status!=="ARCHIVED")?.id||""};own=g?.ownerIds||[];}
    if(kind==="Progress")d={title:g?.title||"",progress:String(g?.progress||0),note:""};
    if(kind==="Review"){d={title:r?.title||"Family review",date:r?.date||strategyToday(),wins:r?.wins||"",challenges:r?.challenges||"",nextSteps:r?.nextSteps||""};own=r?[r.ownerId]:[];}
    setDraft({...d,...defaults});setOwners([...own]);setLinks([...val]);setError("");setEditing({kind,id});
  }
  function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editing)return;
    const {kind,id}=editing,title=(draft.title||"").trim();
    if(kind!=="Progress"&&!title){setError("Please enter a title.");return;}
    const status=(draft.status||"ACTIVE") as StrategyStatus;
    if(kind==="Vision"){
      change(p=>{const previous=p.strategy.vision;
        const changed=title!==previous.title||(draft.statement||"").trim()!==previous.statement||draft.horizon!==previous.horizon;
        return {...p,strategy:{...p.strategy,vision:{...previous,title,statement:(draft.statement||"").trim(),
          horizon:draft.horizon||"",status,updatedAt:strategyToday(),revision:previous.revision+(changed?1:0),
          history:changed?[...previous.history,{statement:previous.statement,changedAt:previous.updatedAt||strategyToday()}]:previous.history}}};});
    }else if(kind==="Value"){
      const value:FamilyValue={id:id||freshId("value-"),title,description:(draft.description||"").trim(),
        priority:Number(draft.priority)||1,symbol:draft.symbol||"heart",archived:false};
      change(p=>({...p,strategy:{...p.strategy,values:id?p.strategy.values.map(v=>v.id===id?value:v):[...p.strategy.values,value]}}));
    }else if(kind==="Mission"){
      const entry:Mission={id:id||freshId("mission-"),title,description:(draft.description||"").trim(),status,
        targetDate:draft.targetDate||"",priority:(draft.priority||"MEDIUM") as Mission["priority"],ownerIds:owners,valueIds:links};
      change(p=>({...p,strategy:{...p.strategy,missions:id?p.strategy.missions.map(v=>v.id===id?entry:v):[...p.strategy.missions,entry]}}));
    }else if(kind==="Milestone"){
      if(!validParent(strategy,"milestone",draft.missionId||"")||!draft.missionId){setError("Choose an active mission.");return;}
      const previous=milestone(id||"");
      const entry:Milestone={id:id||freshId("milestone-"),title,description:(draft.description||"").trim(),
        missionId:draft.missionId,targetDate:draft.targetDate||"",status,
        completedAt:status==="COMPLETED"?(previous?.completedAt||strategyToday()):""};
      change(p=>({...p,strategy:{...p.strategy,milestones:id?p.strategy.milestones.map(v=>v.id===id?entry:v):[...p.strategy.milestones,entry]}}));
    }else if(kind==="Objective"){
      if(!validParent(strategy,"objective",draft.milestoneId||"")||!draft.milestoneId){setError("Choose an active milestone.");return;}
      const entry:Objective={id:id||freshId("objective-"),title,description:(draft.description||"").trim(),status,
        milestoneId:draft.milestoneId,targetDate:draft.targetDate||"",ownerIds:owners,
        metric:(draft.metric||"").trim(),target:(draft.target||"").trim()};
      change(p=>({...p,strategy:{...p.strategy,objectives:id?p.strategy.objectives.map(v=>v.id===id?entry:v):[...p.strategy.objectives,entry]}}));
    }else if(kind==="Goal"){
      if(!validParent(strategy,"goal",draft.objectiveId||"")||!draft.objectiveId){setError("Choose an active objective.");return;}
      const n=Number(draft.progress);if(!Number.isFinite(n)||n<0||n>100){setError("Progress must be between 0 and 100.");return;}
      const old=goals.find(x=>x.id===id),amount=clampProgress(n);
      const entry:Goal={id:id||freshId("goal-"),title,description:(draft.description||"").trim(),meta:draft.meta||"Family priority",
        objectiveId:draft.objectiveId,targetDate:draft.targetDate||"",ownerIds:owners,status,progress:amount,
        image:old?.image||"",color:old?.color||"blue",history:old?.history||[]};
      const updated=old&&old.progress!==amount?{...entry,history:[...(old.history||[]),{at:new Date().toISOString(),progress:amount,note:"Updated goal"}]}:entry;
      change(p=>({...p,goals:id?p.goals.map(x=>x.id===id?updated:x):[...p.goals,updated]}));
    }else if(kind==="Progress"){
      const n=Number(draft.progress);if(!Number.isFinite(n)||n<0||n>100){setError("Progress must be 0–100.");return;}
      change(p=>({...p,goals:p.goals.map(x=>x.id===id?recordGoalProgress(x,n,draft.note||"",new Date().toISOString()):x)}));
    }else if(kind==="Review"){
      const entry:StrategyReview={id:id||freshId("review-"),title,date:draft.date||strategyToday(),ownerId:owners[0]||"",
        wins:(draft.wins||"").trim(),challenges:(draft.challenges||"").trim(),nextSteps:(draft.nextSteps||"").trim()};
      change(p=>({...p,strategy:{...p.strategy,reviews:id?p.strategy.reviews.map(x=>x.id===id?entry:x):[entry,...p.strategy.reviews]}}));
    }
    setEditing(null);onToast(kind+" saved to browser");
  }
  function archive(kind:"Value"|"Mission"|"Milestone"|"Objective"|"Goal",id:string){
    if(kind==="Goal")change(p=>({...p,goals:p.goals.map(x=>x.id===id?{...x,status:"ARCHIVED"}:x)}));
    else if(kind==="Value")change(p=>({...p,strategy:{...p.strategy,values:p.strategy.values.map(x=>x.id===id?{...x,archived:true}:x)}}));
    else{const key=kind==="Mission"?"missions":kind==="Milestone"?"milestones":"objectives";
      change(p=>({...p,strategy:{...p.strategy,[key]:p.strategy[key].map((x:{id:string;status:StrategyStatus})=>
        x.id===id?{...x,status:"ARCHIVED"}:x)}}));}
    onToast(kind+" archived; history preserved");setDetail(null);
  }
  function updateProgress(id:string,by:number){
    change(p=>({...p,goals:p.goals.map(x=>x.id===id?recordGoalProgress(x,x.progress+by,"Quick progress update",new Date().toISOString()):x)}));
    onToast("Goal progress updated");
  }
  return <main className="st-workspace">
    <div className="st-breadcrumb"><button onClick={()=>navigate("Dashboard")}>Dashboard</button><ChevronRight size={14}/> Strategy & Goals</div>
    <section className="st-hero"><div><span className="st-kicker"><Sparkles size={15}/> THE LIFE WE'RE BUILDING TOGETHER</span>
      <h1>Our family's <em>north star.</em></h1><p>Dream together. Plan with purpose. Celebrate every step.</p>
      <footer><span><Heart size={15}/> {activeValues.length} shared values</span><span><Flag size={15}/> {visibleMissions.filter(m=>m.status==="ACTIVE").length} active missions</span></footer></div>
      <div className="st-hero-progress"><strong>{progress===null?"—":progress+"%"}</strong><span>Linked strategy progress</span></div></section>
    <div className="st-preview"><Info size={16}/> Interactive frontend preview · Fictional sample data in browser storage. No backend, AI, verified financial figures or shared permissions.</div>
    <div className="st-metrics">
      {([["Missions",visibleMissions.filter(m=>m.status==="ACTIVE").length,Flag,"Active missions"],
        ["Milestones",visibleMilestones.filter(m=>m.status==="COMPLETED").length,Award,"Milestones achieved"],
        ["Objectives",visibleObjectives.filter(o=>o.status==="ACTIVE").length,Compass,"Active objectives"],
        ["Goals",goals.filter(g=>g.progress===100).length,Target,"Completed goals"],
        ["Vision & Values",activeValues.length,Heart,"Family values"]] as const).map(([name,count,Icon,label])=>
        <button key={name} onClick={()=>setTab(name)}><span><Icon size={21}/></span><strong>{count}</strong><small>{label}</small><ChevronRight size={16}/></button>)}</div>
    <nav className="st-tabs" aria-label="Strategy sections">{tabs.map(t=>
      <button key={t} className={tab===t?"selected":""} aria-current={tab===t?"page":undefined} onClick={()=>{setTab(t);setQuery("");}}>{t}</button>)}</nav>
    {tab==="Overview"&&<>
      <Heading tag="FAMILY STRATEGY" title="The big picture" description="One connected view from the values you share to the goals you track." action={action("Goal","Create Goal")}/>
      <div className="st-overview">
        <section className="st-panel st-vision-box"><div className="st-panel-top"><h3>Our Family Vision</h3><button className="st-link" onClick={()=>setTab("Vision & Values")}>Explore <ArrowRight size={15}/></button></div>
          <span className="st-context">{strategy.vision.horizon}</span><blockquote>“{strategy.vision.statement}”</blockquote>
          <div className="st-value-chips">{activeValues.slice(0,4).map(v=><span key={v.id}><ValueIcon symbol={v.symbol}/>{v.title}</span>)}</div>
          <button className="st-link" onClick={()=>open("Vision")}>Refine family vision <Edit3 size={15}/></button></section>
        <section className="st-panel"><div className="st-panel-top"><h3>Our Missions</h3><button className="st-link" onClick={()=>setTab("Missions")}>View all <ArrowRight size={15}/></button></div>
          {visibleMissions.slice(0,3).map(m=><button className="st-overview-mission" key={m.id} onClick={()=>{setExpanded(m.id);setTab("Missions");}}>
            <span className="st-round"><Rocket size={20}/></span><span><strong>{m.title}</strong><small>{strategy.milestones.filter(k=>k.missionId===m.id).length} milestones</small>
            <Progress value={missionProgress(strategy,goals,m.id)}/></span><b>{missionProgress(strategy,goals,m.id)??"—"}%</b></button>)}</section>
        <section className="st-panel st-next"><div className="st-panel-top"><h3>What Matters Next</h3><Award size={19}/></div>
          {nextMilestone?<><span className="st-context">UPCOMING MILESTONE</span><h3>{nextMilestone.title}</h3>
            <p>{mission(nextMilestone.missionId)?.title}</p><div className="st-datelabel"><CalendarDays size={16}/>{nextMilestone.targetDate}</div>
            <Progress value={milestoneProgress(strategy,goals,nextMilestone.id)}/><button className="st-link" onClick={()=>setTab("Milestones")}>View milestone <ArrowRight size={15}/></button></>:
          <p className="st-muted">Set a milestone target date to see it here.</p>}</section>
        <section className="st-panel"><div className="st-panel-top"><h3>Goal Momentum</h3><button className="st-link" onClick={()=>setTab("Goals")}>All goals <ArrowRight size={15}/></button></div>
          {visibleGoals.slice(0,4).map(g=><button className="st-overview-goal" key={g.id} onClick={()=>setDetail(g.id)}>
            <Target size={20}/><span><strong>{g.title}</strong><small>{g.meta}</small><Progress value={g.progress}/></span><b>{g.progress}%</b></button>)}</section>
      </div>
    </>}
    {tab==="Vision & Values"&&<>
      <Heading tag="PURPOSE & PRINCIPLES" title="What matters most to us" description="Write your north star, define your shared values and revisit them as life changes."
        action={<>{action("Value","Add Value")}<button className="st-btn light" onClick={()=>open("Vision")}><Edit3 size={16}/> Edit Vision</button></>}/>
      <section className="st-panel st-vision-full"><span className="st-context">OUR VISION · REVISION {strategy.vision.revision}</span>
        <h3>{strategy.vision.title}</h3><blockquote>“{strategy.vision.statement}”</blockquote>
        <div><span><CalendarDays size={16}/>{strategy.vision.horizon}</span><Status value={strategy.vision.status}/></div></section>
      <Heading tag="FAMILY VALUES" title="The principles we live by" description="A useful guide for daily choices and future decisions."/>
      <div className="st-archive-toggle"><label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Show archived records</label></div>
      <div className="st-card-grid">{visibleValues.map((v,i)=><article className="st-value-card" key={v.id}>
        <span className={"st-value-icon tone-"+i%5}><ValueIcon symbol={v.symbol}/></span><small>VALUE {v.priority.toString().padStart(2,"0")}</small>
        <h3>{v.title}</h3><p>{v.description}</p><footer><span>{strategy.missions.filter(m=>m.valueIds.includes(v.id)).length} linked missions</span>
          <button aria-label={"Edit "+v.title} onClick={()=>open("Value",v.id)}><Edit3 size={16}/></button>
          <button aria-label={v.archived?"Restore "+v.title:"Archive "+v.title} onClick={()=>v.archived?
          (change(p=>({...p,strategy:{...p.strategy,values:p.strategy.values.map(row=>row.id===v.id?{...row,archived:false}:row)}})),onToast("Value restored")):
          archive("Value",v.id)}>{v.archived?<Check size={16}/>:<X size={16}/>}</button></footer></article>)}
        <button className="st-new-card" onClick={()=>open("Value")}><Plus size={27}/><b>Add a family value</b><small>What's important to your family?</small></button></div>
      <section className="st-panel st-history"><h3>Vision History</h3>{strategy.vision.history.length?strategy.vision.history.slice().reverse().map((h,i)=>
        <p key={i}><b>{h.changedAt}</b> — {h.statement}</p>):<p>No previous versions yet. Updates will be recorded here.</p>}</section>
    </>}
    {tab==="Missions"&&<>
      <Heading tag="LONG-TERM PURPOSE" title="Our Family Missions" description="Turn shared values into lasting commitments." action={action("Mission","Create Mission")}/>
      <div className="st-archive-toggle"><label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Show archived missions</label></div>
      <div className="st-card-grid">{visibleMissions.map(m=><article className="st-mission-card" key={m.id}>
        <div className="st-card-top"><span className="st-round"><Rocket size={23}/></span><Status value={m.status}/></div>
        <h3>{m.title}</h3><p>{m.description}</p>
        <div className="st-value-chips">{m.valueIds.map(id=>strategy.values.find(x=>x.id===id)).filter((v):v is FamilyValue=>!!v).map(v=><span key={v.id}>{v.title}</span>)}</div>
        <div className="st-progress-info"><span>Goal progress</span><strong>{missionProgress(strategy,goals,m.id)??"—"}%</strong></div><Progress value={missionProgress(strategy,goals,m.id)}/>
        <div className="st-card-meta"><Award size={16}/>{strategy.milestones.filter(k=>k.missionId===m.id).length} milestones <CalendarDays size={16}/>{m.targetDate||"No target date"}</div>
        <div className="st-card-actions"><MemberChips members={members} ids={m.ownerIds}/>
          <button onClick={()=>open("Mission",m.id)} aria-label={"Edit "+m.title}><Edit3 size={16}/></button>
          <button onClick={()=>archive("Mission",m.id)} aria-label={"Archive "+m.title}><X size={16}/></button>
          <button onClick={()=>setExpanded(expanded===m.id?null:m.id)}>{expanded===m.id?"Hide":"Explore"} <ArrowRight size={15}/></button></div>
        {expanded===m.id&&<div className="st-expanded"><b>Mission milestones</b>{strategy.milestones.filter(k=>k.missionId===m.id).map(k=>
          <button key={k.id} onClick={()=>setTab("Milestones")}>{k.title}<strong>{milestoneProgress(strategy,goals,k.id)??"—"}%</strong></button>)}
          <button onClick={()=>open("Milestone",undefined,{missionId:m.id})}><Plus size={15}/> New milestone</button></div>}</article>)}
        <button className="st-new-card" onClick={()=>open("Mission")}><Plus size={27}/><b>Create a mission</b><small>Give an important family priority direction.</small></button></div>
    </>}
    {tab==="Milestones"&&<>
      <Heading tag="CHECKPOINTS & ACHIEVEMENTS" title="Family Milestones" description="Break each mission into clear, dated achievements." action={action("Milestone","New Milestone")}/>
      <div className="st-archive-toggle"><label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Show archived milestones</label></div>
      <div className="st-list">{visibleMilestones.map(k=><article className="st-row" key={k.id}><span className="st-row-icon"><Award size={22}/></span>
        <div><span className="st-context">{mission(k.missionId)?.title||"Mission not found"}</span><h3>{k.title}</h3><p>{k.description}</p>
          <div className="st-row-badges"><Status value={k.status}/><span><CalendarDays size={15}/>{k.targetDate||"Not scheduled"}</span>
            <span>{strategy.objectives.filter(o=>o.milestoneId===k.id).length} objectives</span></div><Progress value={milestoneProgress(strategy,goals,k.id)}/></div>
        <strong>{milestoneProgress(strategy,goals,k.id)??"—"}%</strong><div className="st-row-controls">
          <button onClick={()=>open("Milestone",k.id)}><Edit3 size={17}/> Edit</button>
          <button onClick={()=>open("Objective",undefined,{milestoneId:k.id})}><Plus size={17}/> Objective</button>
          <button onClick={()=>archive("Milestone",k.id)} aria-label="Archive milestone"><X size={17}/></button></div>
      </article>)}</div>
    </>}
    {tab==="Objectives"&&<>
      <Heading tag="MEASURABLE OUTCOMES" title="Family Objectives" description="Make each milestone concrete with owned objectives and linked goals."
        action={action("Objective","New Objective")}/>
      <div className="st-archive-toggle"><label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Show archived objectives</label></div>
      <div className="st-card-grid">{visibleObjectives.map(o=><article className="st-objective-card" key={o.id}>
        <span className="st-context">{milestone(o.milestoneId)?.title||"Unlinked milestone"}</span>
        <div className="st-card-top"><span className="st-round"><Compass size={22}/></span><Status value={o.status}/></div>
        <h3>{o.title}</h3><p>{o.description}</p><div className="st-objective-target">{o.metric||"Goal progress"} <b>{o.target||"—"}</b></div>
        <div className="st-progress-info"><span>Linked goal progress</span><strong>{objectiveProgress(strategy,goals,o.id)??"—"}%</strong></div>
        <Progress value={objectiveProgress(strategy,goals,o.id)}/>
        <div className="st-card-meta"><CalendarDays size={16}/>{o.targetDate||"No target date"}<MemberChips members={members} ids={o.ownerIds}/></div>
        <div className="st-card-actions"><button onClick={()=>open("Objective",o.id)}><Edit3 size={16}/> Edit</button>
          <button onClick={()=>archive("Objective",o.id)}><X size={16}/> Archive</button>
          <button onClick={()=>open("Goal",undefined,{objectiveId:o.id})}><Plus size={16}/> Add goal</button></div></article>)}
        <button className="st-new-card" onClick={()=>open("Objective")}><Plus size={27}/><b>Add an objective</b><small>What outcome would move a milestone forward?</small></button></div>
    </>}
    {tab==="Goals"&&<>
      <Heading tag="FAMILY GOAL TRACKER" title="Goals worth working toward" description="Update progress, review history and celebrate measurable change."
        action={action("Goal","Create Family Goal")}/>
      <div className="st-filters"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search family goals"/></label>
        <select value={filter} aria-label="Filter goals by status" onChange={e=>setFilter(e.target.value as typeof filter)}>
          <option value="ALL">All statuses</option>{statuses.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/> Show archived</label></div>
      <div className="st-card-grid">{visibleGoals.map(g=><article className="st-goal-card" key={g.id}>
        <div className="st-goal-head"><span className="st-goal-thumb" style={g.image?{backgroundImage:"url("+g.image+")"}:undefined}>{!g.image&&<Target size={25}/>}</span>
          <div><span className="st-context">{path(g.objectiveId||"")||"Not linked to an objective"}</span><h3>{g.title}</h3>
            <p>{g.description||g.meta}</p><Status value={g.status}/></div></div>
        <div className="st-progress-info"><span>Goal progress</span><strong>{g.progress}%</strong></div><Progress value={g.progress}/>
        <div className="st-card-meta"><CalendarDays size={16}/>{g.targetDate||"No date"}<MemberChips members={members} ids={g.ownerIds||[]}/></div>
        <div className="st-card-actions"><button onClick={()=>setDetail(g.id)}><BookOpen size={16}/> Details</button>
          <button onClick={()=>open("Goal",g.id)}><Edit3 size={16}/> Edit</button><button onClick={()=>open("Progress",g.id)}><TrendingUp size={16}/> Update</button></div></article>)}
        <button className="st-new-card" onClick={()=>open("Goal")}><Plus size={27}/><b>Create a family goal</b><small>Track progress with the whole family's context.</small></button></div>
    </>}
    {tab==="Reviews"&&<>
      <Heading tag="REFLECT & REALIGN" title="Family Strategy Reviews" description="Capture wins, challenges and agreed next steps without any automated judgment."
        action={action("Review","New Review")}/>
      <div className="st-reviews"><section className="st-panel"><h3>Review with intention</h3>
        <p><CheckCircle2 size={19}/> Celebrate meaningful wins, not only achievements.</p>
        <p><Heart size={19}/> Make space for what's challenging.</p>
        <p><Compass size={19}/> Choose a realistic next step.</p>
        {action("Review","Record family review")}</section>
      <section className="st-panel"><h3>Review Journal</h3>{strategy.reviews.length?strategy.reviews.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>
        <div className="st-review" key={r.id}><button onClick={()=>open("Review",r.id)}><Edit3 size={17}/></button>
          <span className="st-context">{r.date}</span><h4>{r.title}</h4>
          {r.wins&&<p><b>Wins: </b>{r.wins}</p>}{r.challenges&&<p><b>Challenges: </b>{r.challenges}</p>}
          {r.nextSteps&&<p><b>Next steps: </b>{r.nextSteps}</p>}</div>):
        <p className="st-muted">No reviews saved yet. Your family's first reflection will appear here.</p>}</section></div>
    </>}
    {goalDetails&&<div className="st-overlay" onClick={()=>setDetail(null)}><aside className="st-drawer" role="dialog" aria-modal="true" aria-label={goalDetails.title} onClick={e=>e.stopPropagation()}>
      <div className="st-dialog-head"><span>FAMILY GOAL</span><button onClick={()=>setDetail(null)} aria-label="Close"><X size={20}/></button></div>
      <div className="st-drawer-banner"><Target size={36}/><h2>{goalDetails.title}</h2><Status value={goalDetails.status}/></div>
      <div className="st-drawer-content"><span className="st-context">{path(goalDetails.objectiveId||"")}</span><p>{goalDetails.description||goalDetails.meta}</p>
        <div className="st-progress-info"><strong>Completion progress</strong><b>{goalDetails.progress}%</b></div><Progress value={goalDetails.progress}/>
        <div className="st-drawer-buttons"><button onClick={()=>updateProgress(goalDetails.id,-10)}>− 10%</button>
          <button onClick={()=>updateProgress(goalDetails.id,10)}>+ 10%</button><button onClick={()=>open("Progress",goalDetails.id)}>Add update</button></div>
        <h3>Progress history</h3>{(goalDetails.history||[]).length?(goalDetails.history||[]).slice().reverse().map((h,i)=>
          <div className="st-history-item" key={i}><strong>{h.progress}% · {h.at.slice(0,10)}</strong><p>{goalHistoryLabel(h)}</p></div>):
          <p className="st-muted">No updates recorded yet. Starting values are fictional preview data.</p>}
        <div className="st-drawer-buttons"><button onClick={()=>open("Goal",goalDetails.id)}>Edit goal</button>
          <button onClick={()=>archive("Goal",goalDetails.id)}>Archive goal</button></div></div></aside></div>}
    {editing&&<div className="st-overlay st-modal-backdrop" onClick={()=>setEditing(null)}><section className="st-modal" role="dialog" aria-modal="true" aria-label={"Edit "+editing.kind} onClick={e=>e.stopPropagation()}>
      <div className="st-dialog-head"><div><small>FAMILY OS · LOCAL PREVIEW</small><h2>{editing.kind==="Progress"?"Update Goal Progress":(editing.id?"Edit ":"New ")+editing.kind}</h2></div>
        <button onClick={()=>setEditing(null)} aria-label="Close"><X size={20}/></button></div>
      <form onSubmit={save}><div className="st-form-grid">
        {editing.kind!=="Progress"&&<Field label={editing.kind+" title"}><input autoFocus required maxLength={120} value={draft.title||""} onChange={e=>editField("title",e.target.value)}/></Field>}
        {editing.kind==="Vision"&&<><Field label="Time horizon"><input maxLength={70} value={draft.horizon||""} onChange={e=>editField("horizon",e.target.value)}/></Field>
          <Field label="Family vision statement"><textarea rows={5} maxLength={650} value={draft.statement||""} onChange={e=>editField("statement",e.target.value)} required/></Field></>}
        {(["Value","Mission","Milestone","Objective","Goal"] as Kind[]).includes(editing.kind)&&
          <Field label="Description"><textarea rows={3} maxLength={550} value={draft.description||""} onChange={e=>editField("description",e.target.value)}/></Field>}
        {editing.kind==="Value"&&<><Field label="Value symbol"><select value={draft.symbol||"heart"} onChange={e=>editField("symbol",e.target.value)}>
          <option value="heart">Heart</option><option value="users">Togetherness</option><option value="sprout">Growth</option><option value="shield">Security</option></select></Field>
          <Field label="Priority"><input type="number" min="1" max="100" value={draft.priority||"1"} onChange={e=>editField("priority",e.target.value)}/></Field></>}
        {editing.kind==="Mission"&&<Field label="Priority"><select value={draft.priority||"MEDIUM"} onChange={e=>editField("priority",e.target.value)}>
          <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></Field>}
        {editing.kind==="Milestone"&&<Field label="Parent mission"><select required value={draft.missionId||""} onChange={e=>editField("missionId",e.target.value)}>
          <option value="">Select mission</option>{strategy.missions.filter(m=>m.status!=="ARCHIVED"||m.id===draft.missionId).map(m=><option value={m.id} key={m.id}>{m.title}</option>)}</select></Field>}
        {editing.kind==="Objective"&&<><Field label="Parent milestone"><select required value={draft.milestoneId||""} onChange={e=>editField("milestoneId",e.target.value)}>
          <option value="">Select milestone</option>{strategy.milestones.filter(m=>m.status!=="ARCHIVED"||m.id===draft.milestoneId).map(m=><option value={m.id} key={m.id}>{m.title}</option>)}</select></Field>
          <Field label="Outcome measure"><input maxLength={80} value={draft.metric||""} onChange={e=>editField("metric",e.target.value)}/></Field>
          <Field label="Target outcome"><input maxLength={80} value={draft.target||""} onChange={e=>editField("target",e.target.value)}/></Field></>}
        {editing.kind==="Goal"&&<><Field label="Parent objective"><select required value={draft.objectiveId||""} onChange={e=>editField("objectiveId",e.target.value)}>
          <option value="">Select objective</option>{strategy.objectives.filter(o=>o.status!=="ARCHIVED"||o.id===draft.objectiveId).map(o=><option value={o.id} key={o.id}>{o.title}</option>)}</select></Field>
          <Field label="Context / category"><input maxLength={80} value={draft.meta||""} onChange={e=>editField("meta",e.target.value)}/></Field></>}
        {(editing.kind==="Goal"||editing.kind==="Progress")&&<Field label="Progress (0–100%)">
          <input type="number" min="0" max="100" value={draft.progress||"0"} onChange={e=>editField("progress",e.target.value)}/></Field>}
        {editing.kind==="Progress"&&<Field label="Progress note"><textarea rows={3} maxLength={320} value={draft.note||""} onChange={e=>editField("note",e.target.value)} placeholder="What changed?"/></Field>}
        {(["Vision","Mission","Milestone","Objective","Goal"] as Kind[]).includes(editing.kind)&&
          <Field label="Status"><select value={draft.status||"ACTIVE"} onChange={e=>editField("status",e.target.value)}>
            {statuses.map(s=><option key={s} value={s}>{s}</option>)}</select></Field>}
        {(["Mission","Milestone","Objective","Goal"] as Kind[]).includes(editing.kind)&&
          <Field label="Target date"><input type="date" value={draft.targetDate||""} onChange={e=>editField("targetDate",e.target.value)}/></Field>}
        {editing.kind==="Review"&&<><Field label="Review date"><input type="date" required value={draft.date||""} onChange={e=>editField("date",e.target.value)}/></Field>
          {([["wins","What went well?"],["challenges","What challenged us?"],["nextSteps","What next?"]] as const).map(([key,label])=>
            <Field key={key} label={label}><textarea rows={3} maxLength={600} value={draft[key]||""} onChange={e=>editField(key,e.target.value)}/></Field>)}</>}
      </div>
      {(["Mission","Objective","Goal","Review"] as Kind[]).includes(editing.kind)&&<div className="st-pickers"><strong>{editing.kind==="Review"?"Recorded by":"Family members responsible"}</strong><div>
        {members.map(m=><label key={m.id} className={owners.includes(m.id)?"selected":""}><input type={editing.kind==="Review"?"radio":"checkbox"}
          name="owner" checked={owners.includes(m.id)} onChange={()=>editing.kind==="Review"?setOwners([m.id]):toggle(owners,setOwners,m.id)}/>{m.name}</label>)}</div></div>}
      {editing.kind==="Mission"&&<div className="st-pickers"><strong>Values supported by this mission</strong><div>
        {activeValues.map(v=><label key={v.id} className={links.includes(v.id)?"selected":""}><input type="checkbox" checked={links.includes(v.id)} onChange={()=>toggle(links,setLinks,v.id)}/>{v.title}</label>)}</div></div>}
      {error&&<p className="st-error" role="alert">{error}</p>}
      <p className="st-privacy"><ShieldCheck size={15}/> Local browser storage only; not an authenticated or private shared account.</p>
      <div className="st-form-actions"><button type="button" className="st-btn light" onClick={()=>setEditing(null)}>Cancel</button>
        <button className="st-btn primary" type="submit"><Check size={16}/> Save {editing.kind}</button></div></form></section></div>}
    <footer className="st-footer">Family OS · Phase 4 — Strategy & Goals <span>Frontend only · Local preview data</span></footer>
  </main>;
}
