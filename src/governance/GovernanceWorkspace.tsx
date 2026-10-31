import {useEffect,useState,type FormEvent} from "react";
import {
  Archive,ArrowRight,BadgeCheck,BookOpen,CalendarDays,Check,CheckCircle2,ChevronRight,
  CircleAlert,Clock3,ClipboardList,Edit3,FileText,Flag,HeartHandshake,History,Home,
  Info,LockKeyhole,MessageSquareText,Plus,Scale,Search,ShieldCheck,Sparkles,ThumbsDown,
  ThumbsUp,UsersRound,Vote,X
} from "lucide-react";
import type {AppData,Member} from "../data";
import {activeMembers} from "../family/model";
import {
  appendGovernanceActivity,cancelDecision,castBallot,closeDecisionVoting,decisionCategoryLabels,
  decisionNeedsInput,decisionOutcomeLabel,decisionRuleLabels,freshId,policyCategoryLabels,
  recordDecisionApproval,reviseConstitution,startDecision,tallyDecision
} from "./model";
import type {
  Decision,DecisionCategory,DecisionOption,DecisionRule,FamilyMeeting,FamilyPolicy,
  GovernanceState,PolicyCategory,Constitution,CharterArticle,DecisionStatus
} from "./model";
import "./governance.css";
type Tab="Overview"|"Decisions"|"Constitution"|"Policies"|"Family Meetings"|"Activity";
type FormKind="Decision"|"Policy"|"Meeting"|"Constitution";
type Props={data:AppData;onChange:(fn:(prev:AppData)=>AppData)=>void;onToast:(message:string)=>void;navigate:(route:string)=>void};
const tabs:Tab[]=["Overview","Decisions","Constitution","Policies","Family Meetings","Activity"];
const policyCategories=Object.keys(policyCategoryLabels) as PolicyCategory[];
const decisionCategories=Object.keys(decisionCategoryLabels) as DecisionCategory[];
const rules=Object.keys(decisionRuleLabels) as DecisionRule[];
const isoNow=()=>new Date().toISOString();
const isoDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const shortDate=(date:string)=>date?date.slice(0,10):"Not set";
function StatusBadge({status}:{status:DecisionStatus}){return <span className={"gv-status status-"+status.toLowerCase()}>{status.replace(/_/g," ")}</span>}
function People({ids,members}:{ids:string[];members:Member[]}){return <span className="gv-avatars">{ids.map(id=>{
  const m=members.find(x=>x.id===id);return m?<span key={id} title={m.name} style={{background:m.color}}>{m.name[0]}</span>:null;
})}</span>}
function Header({tag,title,copy,action}:{tag:string;title:string;copy:string;action?:React.ReactNode}){
  return <header className="gv-section-header"><div><small>{tag}</small><h2>{title}</h2><p>{copy}</p></div>{action}</header>;
}
function PanelHeader({title,copy,action}:{title:string;copy?:string;action?:React.ReactNode}){
  return <header className="gv-panel-header"><div><h3>{title}</h3>{copy&&<p>{copy}</p>}</div>{action}</header>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="gv-field"><span>{label}</span>{children}</label>}
function Empty({title,copy}:{title:string;copy:string}){return <div className="gv-empty"><HeartHandshake size={32}/><h3>{title}</h3><p>{copy}</p></div>}
function MembersPicker({members,selected,onChange}:{members:Member[];selected:string[];onChange:(ids:string[])=>void}){
  return <div className="gv-picker">{members.map(m=><label key={m.id} className={selected.includes(m.id)?"selected":""}>
    <input type="checkbox" checked={selected.includes(m.id)}
      onChange={e=>onChange(e.target.checked?[...selected,m.id]:selected.filter(id=>id!==m.id))}/>{m.name}</label>)}</div>;
}
const newDecision=(actorId:string,householdId:string,members:Member[]):Decision=>{
  const participantIds=members.filter(m=>m.role.toLowerCase().includes("owner")||m.role.toLowerCase().includes("parent")).map(m=>m.id);
  const ids=participantIds.length?participantIds:members.slice(0,2).map(m=>m.id);
  return {id:freshId("decision-"),title:"",description:"",category:"FAMILY",status:"DRAFT",
    rule:"MAJORITY",createdAt:isoDate(),dueDate:"",proposerId:actorId,householdId,
    participantIds:ids,requiredApproverIds:[],quorum:Math.max(1,Math.ceil(ids.length/2)),
    options:[{id:freshId("option-"),title:"",benefits:"",drawbacks:""},
      {id:freshId("option-"),title:"",benefits:"",drawbacks:""}],
    ballots:[],approvals:[],chosenOptionId:"",resolutionNote:"",linkedGoalId:""};
};
const blankPolicy=(householdId:string):FamilyPolicy=>({
  id:freshId("policy-"),title:"",description:"",category:"OTHER",scope:"FAMILY",
  householdId,status:"ACTIVE",kind:"GUIDELINE",version:1,updatedAt:isoNow()
});
const blankMeeting=(actorId:string):FamilyMeeting=>({
  id:freshId("meeting-"),title:"",date:isoDate(),facilitatorId:actorId,
  attendeeIds:actorId?[actorId]:[],summary:"",nextSteps:"",decisionIds:[],archived:false
});
export default function GovernanceWorkspace({data,onChange,onToast,navigate}:Props){
  const state=data.governance;
  const members=activeMembers(data.members,data.family);
  const houses=data.family.households.filter(h=>h.status==="ACTIVE");
  const [actorId,setActorId]=useState(members[0]?.id||"");
  const [tab,setTab]=useState<Tab>("Overview");
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState<"ALL"|DecisionStatus>("ALL");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [choice,setChoice]=useState<string>("");
  const [form,setForm]=useState<FormKind|null>(null);
  const [decisionDraft,setDecisionDraft]=useState<Decision|null>(null);
  const [policyDraft,setPolicyDraft]=useState<FamilyPolicy|null>(null);
  const [meetingDraft,setMeetingDraft]=useState<FamilyMeeting|null>(null);
  const [charterDraft,setCharterDraft]=useState<Constitution|null>(null);
  const [error,setError]=useState("");
  const [showArchived,setShowArchived]=useState(false);
  const actor=members.find(m=>m.id===actorId);
  const name=(id:string)=>data.members.find(m=>m.id===id)?.name||"Unknown family member";
  const household=(id:string)=>houses.find(h=>h.id===id)?.name||"Whole family";
  const selected=state.decisions.find(d=>d.id===selectedId);
  const pending=state.decisions.filter(decisionNeedsInput);
  const awaitingReview=state.decisions.filter(d=>d.status==="APPROVAL_PENDING");
  const decided=state.decisions.filter(d=>d.status==="RESOLVED");
  const activePolicies=state.policies.filter(p=>p.status==="ACTIVE");
  const decisionList=state.decisions.filter(d=>
    (statusFilter==="ALL"||d.status===statusFilter)&&
    (d.title+" "+d.description).toLowerCase().includes(query.toLowerCase()));
  const record=(previous:GovernanceState,action:string,subjectType:string,subjectId:string,detail:string)=>
    appendGovernanceActivity(previous,{action,subjectType,subjectId,detail,actorId,at:isoNow()});
  const change=(fn:(s:GovernanceState)=>GovernanceState)=>onChange(prev=>({...prev,governance:fn(prev.governance)}));
  const mutateDecision=(id:string,action:string,fn:(d:Decision)=>Decision,detail:string)=>{
    try{
      const current=state.decisions.find(d=>d.id===id);
      if(!current)throw new Error("Decision not found.");
      const next=fn(current);
      change(prev=>record({...prev,decisions:prev.decisions.map(d=>d.id===id?next:d)},
        action,"decision",id,detail));
      onToast(action.replace(/_/g," ").toLowerCase()+" saved locally");
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"Action cannot be recorded.");}
  };
  const startEditor=(kind:FormKind,id?:string)=>{
    setError("");setForm(kind);
    if(kind==="Decision"){
      const previous=state.decisions.find(d=>d.id===id);
      setDecisionDraft(previous?structuredClone(previous):newDecision(actorId,houses.find(h=>h.isPrimary)?.id||"",members));
    }
    if(kind==="Policy"){
      const previous=state.policies.find(p=>p.id===id);
      setPolicyDraft(previous?structuredClone(previous):blankPolicy(houses.find(h=>h.isPrimary)?.id||""));
    }
    if(kind==="Meeting"){
      const previous=state.meetings.find(m=>m.id===id);
      setMeetingDraft(previous?structuredClone(previous):blankMeeting(actorId));
    }
    if(kind==="Constitution")setCharterDraft(structuredClone(state.constitution));
  };
  const setDecision=(patch:Partial<Decision>)=>setDecisionDraft(d=>d?{...d,...patch}:d);
  const setPolicy=(patch:Partial<FamilyPolicy>)=>setPolicyDraft(p=>p?{...p,...patch}:p);
  const setMeeting=(patch:Partial<FamilyMeeting>)=>setMeetingDraft(m=>m?{...m,...patch}:m);
  const setCharter=(patch:Partial<Constitution>)=>setCharterDraft(c=>c?{...c,...patch}:c);
  function saveDecision(e:FormEvent){
    e.preventDefault();if(!decisionDraft)return;
    if(!decisionDraft.title.trim()){setError("Please add a decision title.");return;}
    if(decisionDraft.status!=="DRAFT"){setError("Only draft decisions can be edited. Started votes stay immutable.");return;}
    const other=state.decisions.find(d=>d.id===decisionDraft.id);
    const sanitized={...decisionDraft,title:decisionDraft.title.trim(),options:decisionDraft.options.map(o=>({
      ...o,title:o.title.trim(),benefits:o.benefits.trim(),drawbacks:o.drawbacks.trim()
    }))};
    // An incomplete draft can be saved; publishing validates participants, quorum and options.
    change(prev=>record({...prev,decisions:other?prev.decisions.map(d=>d.id===sanitized.id?sanitized:d):
      [sanitized,...prev.decisions]},other?"DECISION_DRAFT_UPDATED":"DECISION_DRAFT_CREATED",
      "decision",sanitized.id,sanitized.title));
    setSelectedId(sanitized.id);setForm(null);onToast("Decision draft saved. Start voting when ready.");
  }
  function savePolicy(e:FormEvent){
    e.preventDefault();if(!policyDraft)return;
    if(!policyDraft.title.trim()||!policyDraft.description.trim()){setError("A policy needs a title and description.");return;}
    const current=state.policies.find(p=>p.id===policyDraft.id);
    const next={...policyDraft,title:policyDraft.title.trim(),description:policyDraft.description.trim(),
      updatedAt:isoNow(),version:(current?.version||0)+(current?1:1)};
    // New policies start at revision 1; subsequent edits increment.
    if(!current)next.version=1;
    change(prev=>record({...prev,policies:current?prev.policies.map(p=>p.id===next.id?next:p):[next,...prev.policies]},
      current?"POLICY_UPDATED":"POLICY_CREATED","policy",next.id,next.title));
    setForm(null);onToast("Preview policy saved. It does not enforce access rules.");
  }
  function saveMeeting(e:FormEvent){
    e.preventDefault();if(!meetingDraft)return;
    if(!meetingDraft.title.trim()){setError("Enter a meeting title.");return;}
    const current=state.meetings.some(m=>m.id===meetingDraft.id);
    const next={...meetingDraft,title:meetingDraft.title.trim(),summary:meetingDraft.summary.trim(),nextSteps:meetingDraft.nextSteps.trim()};
    change(prev=>record({...prev,meetings:current?prev.meetings.map(m=>m.id===next.id?next:m):[next,...prev.meetings]},
      current?"MEETING_UPDATED":"MEETING_CREATED","meeting",next.id,next.title));
    setForm(null);onToast("Family meeting record saved locally.");
  }
  function saveConstitution(e:FormEvent){
    e.preventDefault();if(!charterDraft)return;
    try{
      const next=reviseConstitution(state.constitution,charterDraft,isoNow());
      change(prev=>next===prev.constitution?prev:record({...prev,constitution:next},
        "CONSTITUTION_REVISED","constitution","family-charter","Version "+next.version));
      setForm(null);onToast("Family constitution saved with revision history.");
    }catch(e){setError(e instanceof Error?e.message:"Constitution needs complete articles.");}
  }
  function setBallot(d:Decision){
    if(!choice){setError("Select an option first.");return;}
    mutateDecision(d.id,"BALLOT_RECORDED",current=>castBallot(current,actorId,choice,isoNow()),
      name(actorId)+" selected an option (unverified local preview).");
    setChoice("");
  }
  function openSelected(d:Decision){setSelectedId(d.id);setChoice(d.ballots.find(b=>b.memberId===actorId)?.optionId||"");setError("");}
  function archivePolicy(p:FamilyPolicy){
    change(prev=>record({...prev,policies:prev.policies.map(x=>x.id===p.id?{
      ...x,status:x.status==="ACTIVE"?"ARCHIVED" as const:"ACTIVE" as const,updatedAt:isoNow(),version:x.version+1
    }:x)},"POLICY_STATUS_CHANGED","policy",p.id,p.title));onToast("Policy status changed (preview only).");
  }
  function archiveMeeting(m:FamilyMeeting){
    change(prev=>record({...prev,meetings:prev.meetings.map(x=>x.id===m.id?{...x,archived:!x.archived}:x)},
      "MEETING_STATUS_CHANGED","meeting",m.id,m.title));onToast("Meeting status updated locally.");
  }
  useEffect(()=>{
    const handle=(e:KeyboardEvent)=>{if(e.key==="Escape"){setForm(null);setSelectedId(null);}};
    window.addEventListener("keydown",handle);return ()=>window.removeEventListener("keydown",handle);
  },[]);
  const create=(kind:FormKind,label:string)=><button className="gv-btn primary" onClick={()=>startEditor(kind)}>
    <Plus size={16}/>{label}</button>;
  const switchTab=(next:Tab)=>{setTab(next);setQuery("");setError("");};
  return <main className="gv-workspace">
    <div className="gv-breadcrumb"><button onClick={()=>navigate("Dashboard")}>Dashboard</button><ChevronRight size={14}/> Decisions & Governance</div>
    <div className="gv-hero"><div className="gv-hero-copy"><span><Sparkles size={15}/> DECIDE WITH CLARITY · LEAD WITH CARE</span>
      <h1>A stronger family, <em>one choice at a time.</em></h1><p>Bring voices together, explore options and keep your family's shared commitments in view.</p>
      <div className="gv-hero-chips"><span><HeartHandshake size={15}/> Respectful participation</span>
        <span><ShieldCheck size={15}/> Explicit reviews</span><span><BookOpen size={15}/> Shared principles</span></div>
    </div><div className="gv-hero-icon"><Scale size={52}/></div></div>
    <div className="gv-preview-warning"><CircleAlert size={18}/><span><strong>Frontend governance simulation.</strong> Votes, approvals, roles, policies and actor selection are NOT authenticated,
      verified, legally binding, or enforced. Use fictional data only; localStorage is unencrypted.</span></div>
    <div className="gv-actor"><div><span className="gv-actor-symbol"><UsersRound size={20}/></span><span><strong>Simulation participant</strong><small>Switch perspectives to demonstrate each person's input. This is not a sign-in.</small></span></div>
      <label><span>Preview as</span><select aria-label="Select preview family participant" value={actorId}
        onChange={e=>{setActorId(e.target.value);setChoice("");setError("");}}>
        {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>
    <div className="gv-metrics">
      <button onClick={()=>switchTab("Decisions")}><span className="gv-stat-icon indigo"><Vote size={20}/></span>
        <strong>{pending.length}</strong><small>Decisions need input</small></button>
      <button onClick={()=>switchTab("Decisions")}><span className="gv-stat-icon amber"><Clock3 size={20}/></span>
        <strong>{awaitingReview.length}</strong><small>Review requests pending</small></button>
      <button onClick={()=>switchTab("Decisions")}><span className="gv-stat-icon mint"><BadgeCheck size={20}/></span>
        <strong>{decided.length}</strong><small>Resolved decisions</small></button>
      <button onClick={()=>switchTab("Policies")}><span className="gv-stat-icon blue"><ShieldCheck size={20}/></span>
        <strong>{activePolicies.length}</strong><small>Family guidelines & policies</small></button>
      <button onClick={()=>switchTab("Family Meetings")}><span className="gv-stat-icon pink"><MessageSquareText size={20}/></span>
        <strong>{state.meetings.filter(m=>!m.archived).length}</strong><small>Family meeting records</small></button>
    </div>
    <nav className="gv-tabs" aria-label="Family governance sections">{tabs.map(next=><button key={next}
      className={tab===next?"selected":""} aria-current={tab===next?"page":undefined}
      onClick={()=>switchTab(next)}>{next}</button>)}</nav>
    {tab==="Overview"&&<>
      <Header tag="FAMILY GOVERNANCE" title="A clearer way to decide" copy="A shared perspective on discussions, reviews and the principles you live by."
        action={create("Decision","Start a Decision")}/>
      <div className="gv-overview-grid">
        <section className="gv-panel gv-overview-pending"><PanelHeader title="Awaiting Family Input" copy="Conversations and reviews that need attention."
          action={<button className="gv-link" onClick={()=>switchTab("Decisions")}>View all <ArrowRight size={15}/></button>}/>
          {pending.slice(0,4).map(d=><button className="gv-focus-decision" key={d.id} onClick={()=>openSelected(d)}>
            <span className="gv-focus-icon"><Vote size={20}/></span><span><strong>{d.title}</strong><small>{d.status==="OPEN"?
              tallyDecision(d).cast+" of "+tallyDecision(d).eligible+" local ballots":"Reviewer acknowledgment required"}</small>
              <span className="gv-focus-progress"><i style={{width:(d.status==="OPEN"?tallyDecision(d).cast/Math.max(1,tallyDecision(d).eligible)*100:100)+"%"}}/></span></span>
              <ChevronRight size={16}/></button>)}
          {!pending.length&&<Empty title="Nothing awaiting input" copy="New discussion drafts will appear here once opened."/>}
        </section>
        <section className="gv-panel gv-overview-charter"><PanelHeader title="Our Family Constitution" copy={"Version "+state.constitution.version}
          action={<button className="gv-link" onClick={()=>switchTab("Constitution")}>Read more <ArrowRight size={15}/></button>}/>
          <div className="gv-charter-highlight"><span><BookOpen size={27}/></span><h3>{state.constitution.title}</h3>
            <p>“{state.constitution.preamble}”</p></div>
          <div className="gv-charter-lines">{state.constitution.articles.slice(0,3).map(a=><span key={a.id}><CheckCircle2 size={16}/>{a.heading}</span>)}</div>
        </section>
        <section className="gv-panel gv-overview-policy"><PanelHeader title="Guidelines We Share" copy="Principles for making everyday family decisions."
          action={<button className="gv-link" onClick={()=>switchTab("Policies")}>Policy center <ArrowRight size={15}/></button>}/>
          {activePolicies.slice(0,3).map(p=><button key={p.id} className="gv-policy-summary" onClick={()=>{switchTab("Policies");}}>
            <span><ShieldCheck size={19}/></span><span><strong>{p.title}</strong><small>{policyCategoryLabels[p.category]} · {p.kind==="REVIEW_REQUIRED"?"Review guideline":"Family guideline"}</small></span><ChevronRight size={15}/></button>)}
        </section>
        <section className="gv-panel gv-overview-activity"><PanelHeader title="Governance Activity" copy="Actions captured in this browser's preview session."
          action={<button className="gv-link" onClick={()=>switchTab("Activity")}>History <ArrowRight size={15}/></button>}/>
          {state.activity.slice(0,4).map(a=><div className="gv-activity-mini" key={a.id}><span><History size={15}/></span>
            <div><strong>{a.action.replace(/_/g," ").toLowerCase()}</strong><small>{name(a.actorId)} · {shortDate(a.at)}</small></div></div>)}
          {!state.activity.length&&<p className="gv-muted">No edits recorded yet. Prototype actions will appear here.</p>}
        </section>
      </div>
    </>}
    {tab==="Decisions"&&<>
      <Header tag="STRUCTURED FAMILY DECISIONS" title="Discuss, consider, decide." copy="Record options, gather input, review outcomes and preserve context."
        action={create("Decision","New Decision")}/>
      <div className="gv-filterbar"><label className="gv-search"><Search size={17}/><input aria-label="Search decisions" placeholder="Search family decisions..."
        value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <select aria-label="Filter decision status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="ALL">All statuses</option>{(["DRAFT","OPEN","APPROVAL_PENDING","RESOLVED","DECLINED","CANCELLED"] as DecisionStatus[]).map(s=>
            <option value={s} key={s}>{s.replace(/_/g," ")}</option>)}</select></div>
      <div className="gv-decision-grid">{decisionList.map(d=>{
        const result=tallyDecision(d),linked=data.goals.find(g=>g.id===d.linkedGoalId);
        return <article className="gv-decision-card" key={d.id}><div className="gv-card-top">
          <span className="gv-category"><Flag size={15}/>{decisionCategoryLabels[d.category]}</span><StatusBadge status={d.status}/></div>
          <h3>{d.title}</h3><p>{d.description||"A family question ready for discussion."}</p>
          <div className="gv-decision-facts"><span><UsersRound size={15}/>{d.participantIds.length} invited</span>
            <span><Vote size={15}/>{result.cast} responses</span>
            <span><CalendarDays size={15}/>{shortDate(d.createdAt)}</span></div>
          {linked&&<span className="gv-goal-link"><Flag size={14}/> Linked goal: {linked.title}</span>}
          <div className="gv-decision-footer"><People ids={d.participantIds} members={members}/>
            <button className="gv-btn outline" onClick={()=>openSelected(d)}>{d.status==="DRAFT"?"Review draft":"Open decision"} <ArrowRight size={15}/></button></div>
        </article>;
      })}<button className="gv-add-card" onClick={()=>startEditor("Decision")}><Plus size={28}/><strong>Create a family decision</strong>
        <small>Make room for everyone's voice and clarify what happens next.</small></button></div>
    </>}
    {tab==="Constitution"&&<>
      <Header tag="SHARED FAMILY PRINCIPLES" title="Our Family Constitution" copy="A living collection of family commitments — not a legal instrument."
        action={<button className="gv-btn primary" onClick={()=>startEditor("Constitution")}><Edit3 size={16}/> Revise Constitution</button>}/>
      <section className="gv-panel gv-constitution">
        <div className="gv-constitution-art"><BookOpen size={42}/></div><span className="gv-label">LIVING CHARTER · VERSION {state.constitution.version}</span>
        <h3>{state.constitution.title}</h3><blockquote>“{state.constitution.preamble}”</blockquote>
        <div className="gv-articles">{state.constitution.articles.map((a,i)=><div className="gv-article" key={a.id}>
          <span>{String(i+1).padStart(2,"0")}</span><div><h4>{a.heading}</h4><p>{a.body}</p></div></div>)}</div>
        <footer><span><History size={16}/>{state.constitution.history.length} previous revision(s)</span>
          <button className="gv-link" onClick={()=>startEditor("Constitution")}>Edit articles <Edit3 size={15}/></button></footer>
      </section>
      <section className="gv-panel gv-revision-panel"><PanelHeader title="Constitution History" copy="Earlier versions retained in the browser for review."/>
        {state.constitution.history.slice().reverse().map(h=><div className="gv-history-entry" key={h.version}>
          <span><History size={17}/></span><div><strong>Version {h.version} · {shortDate(h.recordedAt)}</strong>
            <p>{h.title}: {h.preamble}</p><small>{h.articles.length} articles recorded</small></div></div>)}
        {!state.constitution.history.length&&<p className="gv-muted">No earlier versions yet. The first edit will preserve version 1.</p>}</section>
    </>}
    {tab==="Policies"&&<>
      <Header tag="FAMILY GOVERNANCE GUIDELINES" title="Policies & Boundaries" copy="Document expectations, household rules and review points without replacing individual rights."
        action={create("Policy","New Policy")}/>
      <section className="gv-policy-warning"><ShieldCheck size={24}/><div><strong>Guidelines are not enforced permissions.</strong>
        <p>A policy marked “Review required” is a statement of intent; only a decision's explicit reviewer list creates a preview approval step.
          No family role, constitution or policy can reveal another person's private data.</p></div></section>
      <div className="gv-archive-switch"><label><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Include archived policies</label></div>
      <div className="gv-policy-grid">{state.policies.filter(p=>showArchived||p.status==="ACTIVE").map(p=><article className="gv-policy-card" key={p.id}>
        <div className="gv-card-top"><span className="gv-policy-icon"><ShieldCheck size={22}/></span>
          <span className={"gv-status "+(p.status==="ACTIVE"?"status-resolved":"status-cancelled")}>{p.status}</span></div>
        <span className="gv-label">{policyCategoryLabels[p.category].toUpperCase()} · REV {p.version}</span>
        <h3>{p.title}</h3><p>{p.description}</p>
        <div className="gv-policy-tags"><span>{p.scope==="FAMILY"?"Whole family":household(p.householdId)}</span>
          <span>{p.kind==="REVIEW_REQUIRED"?"Review guideline":"General guideline"}</span></div>
        <div className="gv-policy-controls"><button onClick={()=>startEditor("Policy",p.id)}><Edit3 size={16}/> Edit</button>
          <button onClick={()=>archivePolicy(p)}><Archive size={16}/>{p.status==="ACTIVE"?"Archive":"Restore"}</button></div></article>)}
        <button className="gv-add-card" onClick={()=>startEditor("Policy")}><Plus size={27}/><strong>Add a family guideline</strong>
          <small>Document a shared expectation without limiting personal privacy.</small></button></div>
    </>}
    {tab==="Family Meetings"&&<>
      <Header tag="FAMILY MEETING JOURNAL" title="Make time to hear each other" copy="Record conversations, outcomes and next steps; nothing is added to the live calendar."
        action={create("Meeting","Record Meeting")}/>
      <div className="gv-meeting-intro"><span><MessageSquareText size={27}/></span><div><h3>Family check-ins, without pressure</h3>
        <p>Give everyone a voice. Focus on shared understanding, and document only what participants agree is appropriate to record.</p></div></div>
      <div className="gv-archive-switch"><label><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Include archived meetings</label></div>
      <div className="gv-meeting-list">{state.meetings.filter(m=>showArchived||!m.archived).map(m=><article className="gv-meeting-card" key={m.id}>
        <div className="gv-meeting-date"><CalendarDays size={22}/><strong>{shortDate(m.date)}</strong></div>
        <div className="gv-meeting-details"><span className="gv-label">FACILITATOR: {name(m.facilitatorId)}</span><h3>{m.title}</h3>
          <p>{m.summary||"No notes recorded."}</p>{m.nextSteps&&<p><strong>Next steps: </strong>{m.nextSteps}</p>}
          <div className="gv-meeting-bottom"><People ids={m.attendeeIds} members={members}/><span>{m.decisionIds.length} linked decisions</span></div></div>
        <div className="gv-meeting-actions"><button onClick={()=>startEditor("Meeting",m.id)} aria-label={"Edit "+m.title}><Edit3 size={17}/></button>
          <button onClick={()=>archiveMeeting(m)} aria-label={m.archived?"Restore meeting":"Archive meeting"}><Archive size={17}/></button></div></article>)}
        {!state.meetings.length&&<Empty title="Start a family check-in" copy="Meeting records are for shared notes and agreements, not calendar or live messaging."/>}</div>
    </>}
    {tab==="Activity"&&<>
      <Header tag="LOCAL GOVERNANCE HISTORY" title="Decision & Policy Activity" copy="A chronological record of edits, ballots, reviews and local governance actions."/>
      <div className="gv-activity-banner"><History size={23}/><div><strong>This is not a tamper-proof audit trail.</strong>
        <p>Local browser activity can be edited, reset or deleted. Verified identity, immutable audit storage, retention and governance enforcement belong to the future backend.</p></div></div>
      <section className="gv-panel gv-timeline">{state.activity.map(a=><div className="gv-timeline-row" key={a.id}>
        <span className="gv-timeline-node"><History size={17}/></span><div><div className="gv-timeline-top"><strong>{a.action.replace(/_/g," ").toLowerCase()}</strong>
          <time>{shortDate(a.at)}</time></div><p>{a.detail}</p><small>{name(a.actorId)} · {a.subjectType} · local preview</small></div></div>)}
        {!state.activity.length&&<Empty title="No history recorded yet" copy="Once you record an action in this browser, it will appear here."/>}</section>
    </>}
    {selected&&<div className="gv-overlay" onClick={()=>{setSelectedId(null);setError("");}}><aside className="gv-drawer" role="dialog" aria-modal="true"
      aria-label={"Decision: "+selected.title} onClick={e=>e.stopPropagation()}>
      <div className="gv-dialog-head"><small>FAMILY DECISION · LOCAL PREVIEW</small><button onClick={()=>{setSelectedId(null);setError("");}} aria-label="Close"><X size={20}/></button></div>
      <div className="gv-drawer-banner"><span>{decisionCategoryLabels[selected.category]}</span><h2>{selected.title}</h2>
        <StatusBadge status={selected.status}/></div>
      <div className="gv-drawer-body"><p className="gv-decision-description">{selected.description}</p>
        <div className="gv-drawer-metadata"><span><UsersRound size={15}/>{selected.participantIds.length} participants</span>
          <span><Vote size={15}/>{decisionRuleLabels[selected.rule]}</span>
          <span><CalendarDays size={15}/>{shortDate(selected.createdAt)}</span></div>
        {selected.linkedGoalId&&<div className="gv-goal-callout"><Flag size={16}/> Linked goal: {data.goals.find(g=>g.id===selected.linkedGoalId)?.title||"Previous goal"}</div>}
        <div className="gv-drawer-section"><div className="gv-panel-top"><h3>Options & responses</h3>
          <span>{tallyDecision(selected).cast} / {tallyDecision(selected).eligible} ballots</span></div>
          {selected.options.map(o=><label className={"gv-ballot "+(choice===o.id?"selected":"")} key={o.id}>
            <input type="radio" name="decisionChoice" value={o.id} checked={choice===o.id}
              disabled={selected.status!=="OPEN"||!selected.participantIds.includes(actorId)}
              onChange={()=>setChoice(o.id)}/>
            <div><strong>{o.title}</strong><p>{o.benefits||"No benefits documented."}</p>
              {o.drawbacks&&<small>Consider: {o.drawbacks}</small>}</div><b>{tallyDecision(selected).totals[o.id]||0}</b></label>)}
          {selected.status==="OPEN"&&<div className="gv-ballot-actions"><button className="gv-btn primary"
            disabled={!selected.participantIds.includes(actorId)||!actorId} onClick={()=>setBallot(selected)}>
            <Vote size={16}/> Record {name(actorId)}'s ballot</button>
            {!selected.participantIds.includes(actorId)&&<p>This preview participant is not eligible on this proposal.</p>}
          </div>}
          <div className="gv-tally"><div><span>Quorum</span><strong>{tallyDecision(selected).cast} / {selected.quorum} needed</strong></div>
            <div className="gv-tally-track"><i style={{width:Math.min(100,tallyDecision(selected).cast/Math.max(1,selected.quorum)*100)+"%"}}/></div>
            <small>{tallyDecision(selected).canClose?"A single winning option meets the selected vote rule.":
              tallyDecision(selected).reason}</small></div>
        </div>
        <div className="gv-drawer-section"><h3>Decision outcome & review</h3>
          {selected.chosenOptionId&&<div className="gv-outcome"><CheckCircle2 size={21}/><div><strong>{decisionOutcomeLabel(selected)}</strong>
            <p>{selected.status==="APPROVAL_PENDING"?"Awaiting required reviewer acknowledgments.":selected.status==="RESOLVED"?
              "Recorded as resolved in this browser.":selected.status==="DECLINED"?"Review declined.":"Outcome recorded."}</p></div></div>}
          {selected.requiredApproverIds.length>0&&<div className="gv-approval-list">{selected.requiredApproverIds.map(id=>{
            const approval=selected.approvals.find(a=>a.memberId===id);
            return <div key={id}><span>{name(id)}</span><span className={"gv-approval-state "+(approval?.choice==="APPROVE"?"yes":approval?.choice==="REJECT"?"no":"")}>
              {approval?.choice||"AWAITING"}</span></div>;
          })}</div>}
          {selected.status==="DRAFT"&&<div className="gv-drawer-actions"><button className="gv-btn light" onClick={()=>startEditor("Decision",selected.id)}><Edit3 size={15}/> Edit draft</button>
            <button className="gv-btn primary" onClick={()=>mutateDecision(selected.id,"VOTE_OPENED",
              current=>startDecision(current,members.map(m=>m.id)),"Voting opened on draft proposal.")}><Vote size={15}/> Open voting</button></div>}
          {selected.status==="OPEN"&&<div className="gv-drawer-actions"><button className="gv-btn primary"
            onClick={()=>mutateDecision(selected.id,"VOTE_CLOSED",closeDecisionVoting,"Winner recorded subject to any required approvals.")}>
            <Check size={16}/> Close vote & record outcome</button>
            <button className="gv-btn light" onClick={()=>mutateDecision(selected.id,"DECISION_CANCELLED",cancelDecision,"Voting cancelled.")}>Cancel</button></div>}
          {selected.status==="APPROVAL_PENDING"&&<div className="gv-drawer-actions">
            <button className="gv-btn primary" disabled={!selected.requiredApproverIds.includes(actorId)} onClick={()=>
              mutateDecision(selected.id,"REVIEW_APPROVED",d=>recordDecisionApproval(d,actorId,"APPROVE",isoNow()),name(actorId)+" approved preview outcome.")}>
              <ThumbsUp size={16}/> Approve as {name(actorId)}</button>
            <button className="gv-btn danger" disabled={!selected.requiredApproverIds.includes(actorId)} onClick={()=>
              mutateDecision(selected.id,"REVIEW_DECLINED",d=>recordDecisionApproval(d,actorId,"REJECT",isoNow()),name(actorId)+" declined preview outcome.")}>
              <ThumbsDown size={16}/> Decline</button></div>}
          {selected.status==="CANCELLED"&&<p className="gv-muted">This proposal was cancelled. Its local history is retained.</p>}
          {selected.status==="RESOLVED"&&<p className="gv-muted">Resolution was recorded. Nothing is executed automatically.</p>}
          {selected.status==="DECLINED"&&<p className="gv-muted">A named reviewer declined. Create a fresh proposal to reconsider.</p>}
        </div>
        {error&&<p role="alert" className="gv-error">{error}</p>}
        <p className="gv-disclaimer"><LockKeyhole size={16}/> No signature, verified voter identity, guardian authority or enforceable approval exists in this preview.</p>
      </div>
    </aside></div>}
    {form&&<div className="gv-overlay gv-form-overlay" onClick={()=>{setForm(null);setError("");}}><section className="gv-modal" role="dialog" aria-modal="true"
      aria-label={"Family "+form+" editor"} onClick={e=>e.stopPropagation()}>
      <div className="gv-dialog-head"><div><small>FAMILY OS · GOVERNANCE PREVIEW</small><h2>{form==="Constitution"?"Revise Family Constitution":form==="Decision"?(state.decisions.some(d=>d.id===decisionDraft?.id)?"Edit Decision Draft":"Create a Decision"):
        form==="Meeting"?"Family Meeting Record":"Family Policy"}</h2></div>
        <button onClick={()=>{setForm(null);setError("");}} aria-label="Close"><X size={20}/></button></div>
      {form==="Decision"&&decisionDraft&&<form onSubmit={saveDecision}>
        <div className="gv-form-grid"><Field label="Decision title"><input required autoFocus maxLength={140}
          value={decisionDraft.title} onChange={e=>setDecision({title:e.target.value})} placeholder="What should we decide together?"/></Field>
          <Field label="Category"><select value={decisionDraft.category} onChange={e=>setDecision({category:e.target.value as DecisionCategory})}>
            {decisionCategories.map(k=><option key={k} value={k}>{decisionCategoryLabels[k]}</option>)}</select></Field>
          <Field label="Description / context"><textarea rows={3} maxLength={700}
            value={decisionDraft.description} onChange={e=>setDecision({description:e.target.value})}/></Field>
          <Field label="Household"><select value={decisionDraft.householdId} onChange={e=>setDecision({householdId:e.target.value})}>
            <option value="">Whole family</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
          <Field label="Voting rule"><select value={decisionDraft.rule} onChange={e=>setDecision({rule:e.target.value as DecisionRule})}>
            {rules.map(r=><option key={r} value={r}>{decisionRuleLabels[r]}</option>)}</select></Field>
          <Field label="Minimum ballots (quorum)"><input type="number" min={1} max={Math.max(1,decisionDraft.participantIds.length)}
            value={decisionDraft.quorum} onChange={e=>setDecision({quorum:Number(e.target.value)})}/></Field>
          <Field label="Review / decision deadline"><input type="date" value={decisionDraft.dueDate}
            onChange={e=>setDecision({dueDate:e.target.value})}/></Field>
          <Field label="Linked strategy goal"><select value={decisionDraft.linkedGoalId}
            onChange={e=>setDecision({linkedGoalId:e.target.value})}><option value="">No linked goal</option>
            {data.goals.filter(g=>g.status!=="ARCHIVED").map(g=><option value={g.id} key={g.id}>{g.title}</option>)}</select></Field></div>
        <div className="gv-form-label"><strong>Eligible family participants</strong><small>Who may record a preview ballot?</small></div>
        <MembersPicker members={members} selected={decisionDraft.participantIds}
          onChange={ids=>setDecision({participantIds:ids,quorum:Math.min(Math.max(1,decisionDraft.quorum),Math.max(1,ids.length))})}/>
        <div className="gv-form-label"><strong>Required reviewers</strong><small>If selected, all must affirm the winning option before resolution. This is simulated, not authentication.</small></div>
        <MembersPicker members={members} selected={decisionDraft.requiredApproverIds}
          onChange={ids=>setDecision({requiredApproverIds:ids})}/>
        <div className="gv-form-label"><strong>Options to consider</strong><small>Add at least two. Describe pros and drawbacks, not just a preference.</small></div>
        <div className="gv-options-editor">{decisionDraft.options.map((o,i)=><div className="gv-option-editor" key={o.id}>
          <div><strong>OPTION {i+1}</strong><button type="button" disabled={decisionDraft.options.length<=2} onClick={()=>setDecision({
            options:decisionDraft.options.filter(x=>x.id!==o.id)})} aria-label={"Remove option "+(i+1)}><X size={16}/></button></div>
          <input maxLength={120} placeholder="Option title" value={o.title} onChange={e=>setDecision({
            options:decisionDraft.options.map(x=>x.id===o.id?{...x,title:e.target.value}:x)})}/>
          <input maxLength={240} placeholder="What could be good about it?" value={o.benefits} onChange={e=>setDecision({
            options:decisionDraft.options.map(x=>x.id===o.id?{...x,benefits:e.target.value}:x)})}/>
          <input maxLength={240} placeholder="What needs consideration?" value={o.drawbacks} onChange={e=>setDecision({
            options:decisionDraft.options.map(x=>x.id===o.id?{...x,drawbacks:e.target.value}:x)})}/></div>)}</div>
        <button type="button" className="gv-add-inline" onClick={()=>setDecision({options:[...decisionDraft.options,
          {id:freshId("option-"),title:"",benefits:"",drawbacks:""}]})}><Plus size={16}/> Add another option</button>
        {error&&<p className="gv-error" role="alert">{error}</p>}<FormFooter onCancel={()=>setForm(null)} label="Save draft"/>
      </form>}
      {form==="Policy"&&policyDraft&&<form onSubmit={savePolicy}><div className="gv-form-grid">
        <Field label="Policy title"><input required autoFocus maxLength={130} value={policyDraft.title}
          onChange={e=>setPolicy({title:e.target.value})}/></Field>
        <Field label="Category"><select value={policyDraft.category} onChange={e=>setPolicy({category:e.target.value as PolicyCategory})}>
          {policyCategories.map(k=><option key={k} value={k}>{policyCategoryLabels[k]}</option>)}</select></Field>
        <Field label="Policy wording"><textarea required rows={4} maxLength={650} value={policyDraft.description}
          onChange={e=>setPolicy({description:e.target.value})}/></Field>
        <Field label="Scope"><select value={policyDraft.scope} onChange={e=>setPolicy({scope:e.target.value as FamilyPolicy["scope"]})}>
          <option value="FAMILY">Whole family</option><option value="HOUSEHOLD">Specific household</option></select></Field>
        {policyDraft.scope==="HOUSEHOLD"&&<Field label="Household"><select value={policyDraft.householdId}
          onChange={e=>setPolicy({householdId:e.target.value})}>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>}
        <Field label="Policy type"><select value={policyDraft.kind}
          onChange={e=>setPolicy({kind:e.target.value as FamilyPolicy["kind"]})}>
          <option value="GUIDELINE">General family guideline</option><option value="REVIEW_REQUIRED">Requires discussion / review (label only)</option></select></Field></div>
        {error&&<p className="gv-error" role="alert">{error}</p>}<FormFooter onCancel={()=>setForm(null)} label="Save policy"/>
      </form>}
      {form==="Meeting"&&meetingDraft&&<form onSubmit={saveMeeting}><div className="gv-form-grid">
        <Field label="Meeting title"><input required autoFocus maxLength={130} value={meetingDraft.title}
          onChange={e=>setMeeting({title:e.target.value})}/></Field>
        <Field label="Meeting date"><input type="date" required value={meetingDraft.date}
          onChange={e=>setMeeting({date:e.target.value})}/></Field>
        <Field label="Facilitator (simulation)"><select value={meetingDraft.facilitatorId}
          onChange={e=>setMeeting({facilitatorId:e.target.value})}>{members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Meeting summary"><textarea rows={4} maxLength={800} value={meetingDraft.summary}
          onChange={e=>setMeeting({summary:e.target.value})}/></Field>
        <Field label="Next steps"><textarea rows={4} maxLength={800} value={meetingDraft.nextSteps}
          onChange={e=>setMeeting({nextSteps:e.target.value})}/></Field></div>
        <div className="gv-form-label"><strong>People attending</strong><small>Choose family members present for the discussion.</small></div>
        <MembersPicker members={members} selected={meetingDraft.attendeeIds} onChange={ids=>setMeeting({attendeeIds:ids})}/>
        <div className="gv-form-label"><strong>Related decisions</strong><small>Reference proposals discussed, without changing their status.</small></div>
        <div className="gv-picker">{state.decisions.map(d=><label key={d.id} className={meetingDraft.decisionIds.includes(d.id)?"selected":""}>
          <input type="checkbox" checked={meetingDraft.decisionIds.includes(d.id)}
            onChange={e=>setMeeting({decisionIds:e.target.checked?[...meetingDraft.decisionIds,d.id]:
              meetingDraft.decisionIds.filter(id=>id!==d.id)})}/>{d.title}</label>)}</div>
        {error&&<p className="gv-error" role="alert">{error}</p>}<FormFooter onCancel={()=>setForm(null)} label="Save meeting"/>
      </form>}
      {form==="Constitution"&&charterDraft&&<form onSubmit={saveConstitution}><div className="gv-form-grid">
        <Field label="Constitution title"><input autoFocus required maxLength={130} value={charterDraft.title}
          onChange={e=>setCharter({title:e.target.value})}/></Field>
        <Field label="Family preamble"><textarea rows={3} maxLength={700} value={charterDraft.preamble}
          onChange={e=>setCharter({preamble:e.target.value})}/></Field></div>
        <div className="gv-form-label"><strong>Articles & family commitments</strong><small>Editing saves the previous full version.</small></div>
        <div className="gv-options-editor">{charterDraft.articles.map((a,i)=><div className="gv-option-editor" key={a.id}>
          <div><strong>ARTICLE {i+1}</strong><button type="button" disabled={charterDraft.articles.length<2}
            onClick={()=>setCharter({articles:charterDraft.articles.filter(x=>x.id!==a.id)})} aria-label={"Remove article "+(i+1)}><X size={16}/></button></div>
          <input placeholder="Article heading" required maxLength={130} value={a.heading}
            onChange={e=>setCharter({articles:charterDraft.articles.map(x=>x.id===a.id?{...x,heading:e.target.value}:x)})}/>
          <textarea required placeholder="How will we live this principle?" rows={3} maxLength={650} value={a.body}
            onChange={e=>setCharter({articles:charterDraft.articles.map(x=>x.id===a.id?{...x,body:e.target.value}:x)})}/></div>)}</div>
        <button type="button" className="gv-add-inline" onClick={()=>setCharter({articles:[...charterDraft.articles,
          {id:freshId("article-"),heading:"",body:""}]})}><Plus size={16}/> Add an article</button>
        {error&&<p className="gv-error" role="alert">{error}</p>}<FormFooter onCancel={()=>setForm(null)} label="Save new version"/>
      </form>}
      <p className="gv-disclaimer"><LockKeyhole size={15}/> Preview only. No verified participants, legal consent, enforcement or private shared storage.</p>
    </section></div>}
    <footer className="gv-footer">Family OS · Phase 5 — Decisions & Governance <span>Frontend simulation · Browser-local data only</span></footer>
  </main>;
}
function FormFooter({onCancel,label}:{onCancel:()=>void;label:string}){
  return <div className="gv-modal-actions"><button type="button" className="gv-btn light" onClick={onCancel}>Cancel</button>
    <button type="submit" className="gv-btn primary"><Check size={16}/>{label}</button></div>;
}
