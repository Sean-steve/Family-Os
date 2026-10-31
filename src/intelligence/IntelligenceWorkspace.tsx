import {useMemo,useState,type FormEvent,type ReactNode} from "react";
import {
  Activity,ArrowRight,BookOpen,CalendarClock,CalendarDays,Check,CheckCircle2,
  ChevronRight,ClipboardList,Compass,Eye,EyeOff,FileText,Heart,
  HelpCircle,Info,Lightbulb,MessageCircle,MessagesSquare,Plus,RefreshCw,
  Search,ShieldAlert,ShieldCheck,Sparkles,Target,Trash2,TriangleAlert,X
} from "lucide-react";
import type {AppData} from "../data";
import {dateKey} from "../operations/model";
import {
  chiefOfStaffReply,chiefPrompts,createBriefing,deriveSignals,dismissSignal,evidenceCoverage,
  INTELLIGENCE_VERSION,isDismissed,restoreSignal,saveBriefing
} from "./model";
import type {
  Availability,ChiefPrompt,IntelligenceState,Signal,SignalDomain,SignalTone
} from "./model";
import "./intelligence.css";
type Section="Overview"|"Signals"|"Recommendations"|"Briefings"|"Chief of Staff";
type Props={data:AppData;onChange:(fn:(prev:AppData)=>AppData)=>void;onToast:(message:string)=>void;navigate:(route:string)=>void};
type Reply={id:number;question:string;answer:string;signals:Signal[];disclaimer:string};
const sections:Section[]=["Overview","Signals","Recommendations","Briefings","Chief of Staff"];
const categories:SignalDomain[]=["Operations","Calendar","Goals","Decisions","Experiences","Traditions"];
const tones:SignalTone[]=["ATTENTION","OPPORTUNITY","CELEBRATE"];
const today=dateKey();
function SmallHeader({tag,title,desc,action}:{tag:string;title:string;desc:string;action?:ReactNode}){
  return <header className="in-head"><div><span>{tag}</span><h2>{title}</h2><p>{desc}</p></div>{action}</header>;
}
function ScopeNote(){return <div className="in-scope"><ShieldAlert size={17}/>
  <div><strong>Rule-based preview · No generative AI or private cross-OS access.</strong>
    <span>Insights use only dated, family-labelled records already in this browser. Nothing automatically changes a family decision, task, calendar or goal.
      This is not authenticated and does not verify consent. All demo examples are fictional.</span></div></div>}
function EvidenceBadge({status}:{status:Availability["status"]}){
  return <span className={"in-data-status "+(status==="RECORDED_ONLY"?"recorded":status==="NOT_CONNECTED"?"not-connected":"insufficient")}>
    {status==="RECORDED_ONLY"?"Browser records only":status==="NOT_CONNECTED"?"Not connected":"Insufficient data"}</span>;
}
function ToneBadge({tone}:{tone:SignalTone}){
  return <span className={"in-tone "+tone.toLowerCase()}>{tone==="ATTENTION"?"Needs review":tone==="OPPORTUNITY"?"Planning idea":"Upcoming ritual"}</span>;
}
function IconForDomain({domain}:{domain:SignalDomain}){
  if(domain==="Goals")return <Target size={20}/>;
  if(domain==="Decisions")return <MessagesSquare size={20}/>;
  if(domain==="Operations")return <ClipboardList size={20}/>;
  if(domain==="Calendar")return <CalendarDays size={20}/>;
  if(domain==="Experiences")return <Compass size={20}/>;
  return <Heart size={20}/>;
}
function NoEvidence({text}:{text:string}){
  return <div className="in-empty"><Info size={28}/><h3>Nothing supported by these records yet</h3><p>{text}</p></div>;
}
function StatusCard({entry,onNavigate}:{entry:Availability;onNavigate:(route:string)=>void}){
  return <article className="in-coverage-card">
    <div className="in-coverage-head"><strong>{entry.area}</strong><EvidenceBadge status={entry.status}/></div>
    <p>{entry.detail}</p>
    {entry.status==="RECORDED_ONLY"&&entry.route!=="Insights"&&<button className="in-link" onClick={()=>onNavigate(entry.route)}>
      Review source <ArrowRight size={14}/></button>}
  </article>;
}
function SignalCard({signal,onOpen,onGo,dismissed}:{signal:Signal;onOpen:()=>void;onGo:(route:string)=>void;dismissed?:boolean}){
  return <article className={"in-signal-card "+(dismissed?"dimmed":"")}>
    <div className="in-signal-top"><div className="in-signal-icon"><IconForDomain domain={signal.domain}/></div>
      <ToneBadge tone={signal.tone}/></div>
    <span className="in-category">{signal.domain} · {signal.nature==="OBSERVATION"?"Recorded observation":"Human-review suggestion"}</span>
    <h3>{signal.title}</h3><p>{signal.summary}</p>
    <div className="in-signal-source"><BookOpen size={14}/> {signal.evidence.length} linked source record{signal.evidence.length===1?"":"s"} · As of {signal.asOf}</div>
    <div className="in-card-actions"><button className="in-text-btn" onClick={onOpen}><Eye size={16}/> Why this?</button>
      <button className="in-text-btn next" onClick={()=>onGo(signal.destination)}>{signal.nextStep} <ArrowRight size={15}/></button></div>
  </article>;
}
export default function IntelligenceWorkspace({data,onChange,onToast,navigate}:Props){
  const [section,setSection]=useState<Section>("Overview");
  const [query,setQuery]=useState("");
  const [domain,setDomain]=useState<"ALL"|SignalDomain>("ALL");
  const [tone,setTone]=useState<"ALL"|SignalTone>("ALL");
  const [showDismissed,setShowDismissed]=useState(false);
  const [detail,setDetail]=useState<string|null>(null);
  const [selectedBrief,setSelectedBrief]=useState<string|null>(null);
  const [briefNote,setBriefNote]=useState("");
  const [draftQuestion,setDraftQuestion]=useState("");
  const [messages,setMessages]=useState<Reply[]>([]);
  const [assistantError,setAssistantError]=useState("");
  const [refDate,setRefDate]=useState(today);
  const derived=useMemo(()=>deriveSignals(data,refDate),[data,refDate]);
  const briefing=useMemo(()=>createBriefing(data,refDate),[data,refDate]);
  const coverage=useMemo(()=>evidenceCoverage(data),[data]);
  const visible=derived.filter(s=>showDismissed||!isDismissed(s,data.intelligence));
  const attention=visible.filter(s=>s.tone==="ATTENTION");
  const opportunities=visible.filter(s=>s.tone==="OPPORTUNITY");
  const celebrations=visible.filter(s=>s.tone==="CELEBRATE");
  const filtered=visible.filter(s=>(domain==="ALL"||s.domain===domain)&&(tone==="ALL"||s.tone===tone)&&
    (s.title+" "+s.summary+" "+s.domain).toLowerCase().includes(query.trim().toLowerCase()));
  const activeDetail=derived.find(s=>s.id===detail);
  const activeBrief=data.intelligence.savedBriefs.find(b=>b.id===selectedBrief);
  const change=(fn:(current:IntelligenceState)=>IntelligenceState)=>
    onChange(prev=>({...prev,intelligence:fn(prev.intelligence)}));
  const openSection=(target:Section)=>{setSection(target);setDomain("ALL");setTone("ALL");setQuery("");};
  const toggleDismiss=(s:Signal)=>{
    if(isDismissed(s,data.intelligence)){change(current=>restoreSignal(current,s.id));onToast("Signal restored to the current view");}
    else {change(current=>dismissSignal(current,s,new Date().toISOString()));onToast("Signal hidden for its current evidence snapshot");}
    setDetail(null);
  };
  const saveCurrent=()=>{
    change(current=>saveBriefing(current,briefing,new Date().toISOString(),briefNote));
    setBriefNote("");onToast("Current family briefing saved in this browser");
    openSection("Briefings");
  };
  function reply(prompt:ChiefPrompt,question:string){
    const result=chiefOfStaffReply(data,prompt,refDate);
    setMessages(previous=>[...previous,{id:previous.length+1,question,answer:result.heading+"\n\n"+result.body,
      signals:result.signals,disclaimer:result.disclaimer}].slice(-20));
    setAssistantError("");
  }
  function submitQuestion(e:FormEvent){
    e.preventDefault();
    const question=draftQuestion.trim();
    if(!question){setAssistantError("Enter a question or choose one of the suggested prompts.");return;}
    const q=question.toLowerCase();
    const prompt:ChiefPrompt|null=/unknown|missing|data|connect|privacy|not know|gap/.test(q)?"gaps":
      /celebrat|tradition|positive|good news|joy/.test(q)?"positive":
      /plan|next|opportun|idea|suggest/.test(q)?"plans":
      /attention|priority|urgent|risk|issue|problem|review|due|overdue/.test(q)?"attention":null;
    if(prompt)reply(prompt,question);
    else setAssistantError("This local rule-based assistant supports attention, planning, traditions, and data gaps only. It cannot answer open-ended personal questions or access private data.");
    setDraftQuestion("");
  }
  const preview=(s:Signal)=>setDetail(s.id);
  return <main className="in-workspace">
    <div className="in-crumb"><button onClick={()=>navigate("Dashboard")}>Dashboard</button><ChevronRight size={14}/> Family Intelligence & Insights</div>
    <section className="in-hero"><div><span className="in-eyebrow"><Sparkles size={15}/> FAMILY INSIGHTS · GROUNDED IN EVIDENCE</span>
      <h1>Clarity for the moments <em>that matter.</em></h1>
      <p>See what your recorded plans suggest, review the evidence, and choose the next step together.</p>
      <div className="in-hero-foot"><span><ShieldCheck size={15}/> Transparent rules</span><span><BookOpen size={15}/> Traceable sources</span>
        <span><Heart size={15}/> Human decisions</span></div></div>
      <div className="in-hero-mark"><Activity size={48}/></div></section>
    <ScopeNote/>
    <div className="in-date-banner"><span><CalendarClock size={16}/> Evidence as of</span><input type="date" aria-label="Intelligence reference date"
      value={refDate} onChange={e=>setRefDate(e.target.value||today)}/>
      <button onClick={()=>setRefDate(dateKey())}><RefreshCw size={15}/> Today</button>
      <small>Rule set: {INTELLIGENCE_VERSION} · no forecasts or estimated confidence</small></div>
    <div className="in-stat-grid">
      <button onClick={()=>{openSection("Signals");setTone("ATTENTION");}}><span className="in-stat-icon amber"><TriangleAlert size={20}/></span>
        <strong>{attention.length}</strong><small>Dated items to review</small></button>
      <button onClick={()=>openSection("Recommendations")}><span className="in-stat-icon blue"><Lightbulb size={20}/></span>
        <strong>{opportunities.length}</strong><small>Planning suggestions</small></button>
      <button onClick={()=>{openSection("Signals");setTone("CELEBRATE");}}><span className="in-stat-icon mint"><Heart size={20}/></span>
        <strong>{celebrations.length}</strong><small>Upcoming traditions</small></button>
      <button onClick={()=>openSection("Briefings")}><span className="in-stat-icon purple"><FileText size={20}/></span>
        <strong>{data.intelligence.savedBriefs.length}</strong><small>Saved local briefings</small></button>
    </div>
    <nav className="in-tabs" aria-label="Intelligence sections">{sections.map(s=><button key={s}
      className={section===s?"selected":""} aria-current={section===s?"page":undefined} onClick={()=>openSection(s)}>{s}</button>)}</nav>
    {section==="Overview"&&<>
      <SmallHeader tag="INTELLIGENCE COMMAND CENTER" title="Your family's current picture"
        desc="A calm overview of what the available browser records support — without assigning wellbeing scores or inventing outcomes."
        action={<button className="in-btn primary" onClick={()=>openSection("Briefings")}><FileText size={16}/> Build briefing</button>}/>
      <div className="in-overview-layout">
        <section className="in-panel in-brief-preview"><div className="in-panel-top"><h3><Sparkles size={17}/> Today's family brief</h3>
          <button className="in-link" onClick={()=>openSection("Briefings")}>Open briefing <ArrowRight size={15}/></button></div>
          <div className="in-brief-cover"><span>WHAT OUR RECORDS SAY</span><h3>{refDate}</h3><p>{briefing.summary}</p></div>
          <div className="in-brief-lines">
            <div><span className="in-mini-dot amber"/><strong>{briefing.attention.length}</strong><span>Recorded attention signals</span></div>
            <div><span className="in-mini-dot blue"/><strong>{briefing.opportunities.length}</strong><span>Optional planning suggestions</span></div>
            <div><span className="in-mini-dot mint"/><strong>{briefing.celebrations.length}</strong><span>Upcoming traditions</span></div></div>
          <p className="in-low">No health, finance or family relationship scores. An empty signal list is not a positive safety assessment.</p>
          <button className="in-btn subtle" onClick={()=>openSection("Briefings")}><BookOpen size={15}/> Read full evidence</button>
        </section>
        <section className="in-panel"><div className="in-panel-top"><h3>What deserves attention</h3>
          <button className="in-link" onClick={()=>{openSection("Signals");setTone("ATTENTION");}}>All signals <ArrowRight size={15}/></button></div>
          {attention.slice(0,4).map(s=><button className="in-mini-row" onClick={()=>preview(s)} key={s.id}>
            <span className="in-mini-icon amber"><IconForDomain domain={s.domain}/></span><span><strong>{s.title}</strong>
              <small>{s.domain} · {s.evidence.length} source record(s)</small></span><ChevronRight size={16}/></button>)}
          {!attention.length&&<NoEvidence text="No dated attention rules matched. We have not checked private records or external systems."/>}
        </section>
        <section className="in-panel"><div className="in-panel-top"><h3>Worth planning</h3>
          <button className="in-link" onClick={()=>openSection("Recommendations")}>All suggestions <ArrowRight size={15}/></button></div>
          {opportunities.slice(0,4).map(s=><button key={s.id} className="in-mini-row" onClick={()=>preview(s)}>
            <span className="in-mini-icon blue"><IconForDomain domain={s.domain}/></span><span><strong>{s.title}</strong>
              <small>Suggested review · {s.domain}</small></span><ChevronRight size={16}/></button>)}
          {!opportunities.length&&<NoEvidence text="No date-matched planning suggestions. Your family can still make new plans."/>}
        </section>
        <section className="in-panel"><div className="in-panel-top"><h3>Evidence readiness</h3>
          <button className="in-link" onClick={()=>openSection("Briefings")}>Source details <ArrowRight size={15}/></button></div>
          <div className="in-readiness-list">{coverage.map(c=><StatusCard entry={c} key={c.area} onNavigate={navigate}/>)}</div>
          <p className="in-low">HumanKernelOS, Finance OS and Health/Nutrition OS are not connected to this prototype.</p>
        </section>
      </div>
    </>}
    {section==="Signals"&&<>
      <SmallHeader tag="TRACEABLE FAMILY SIGNALS" title="Family Insights & Risks"
        desc="Observations from explicitly recorded, non-sensitive family workflows. Each item includes a rule, source references and limitations."/>
      <div className="in-filterbar"><label className="in-search"><Search size={16}/><input aria-label="Search insights"
        value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search evidence-backed signals..."/></label>
        <label>Area <select aria-label="Filter signal domain" value={domain} onChange={e=>setDomain(e.target.value as typeof domain)}>
          <option value="ALL">All domains</option>{categories.map(c=><option value={c} key={c}>{c}</option>)}</select></label>
        <label>Type <select aria-label="Filter signal tone" value={tone} onChange={e=>setTone(e.target.value as typeof tone)}>
          <option value="ALL">All signals</option>{tones.map(t=><option value={t} key={t}>{t}</option>)}</select></label>
        <label className="in-check"><input type="checkbox" checked={showDismissed} onChange={e=>setShowDismissed(e.target.checked)}/> Show hidden</label></div>
      <div className="in-signal-grid">{filtered.map(s=><SignalCard key={s.id} signal={s} onOpen={()=>preview(s)}
        onGo={navigate} dismissed={isDismissed(s,data.intelligence)}/>)}</div>
      {!filtered.length&&<NoEvidence text="No rule-matched signals for this filter. Missing evidence and unconnected systems cannot be interpreted as a clean bill of health."/>}
    </>}
    {section==="Recommendations"&&<>
      <SmallHeader tag="PROPOSE, NEVER AUTO-EXECUTE" title="Suggested next steps"
        desc="Every suggestion opens the owning workspace. The assistant cannot book, reassign, approve, send or decide on behalf of family members."/>
      <div className="in-recommendation-head"><Lightbulb size={24}/><div><strong>Review what might help next</strong>
        <p>Rule-based advisory ideas from family-owned plans, with no probability or personal profiling.</p></div></div>
      <div className="in-signal-grid">{opportunities.map(s=><SignalCard key={s.id} signal={s} onOpen={()=>preview(s)} onGo={navigate}/>)}</div>
      {!opportunities.length&&<NoEvidence text="No planning rules matched dated records right now. This is not an indication that the family has no needs."/>}
    </>}
    {section==="Briefings"&&<>
      <SmallHeader tag="EXPLAINABLE FAMILY BRIEFINGS" title="Family Chief-of-Staff Brief"
        desc="Generate a snapshot from the current rule engine and save it locally for later review, without sending anything or changing a family plan."
        action={<button className="in-btn primary" onClick={saveCurrent}><Plus size={16}/> Save briefing snapshot</button>}/>
      <div className="in-briefing-layout"><section className="in-panel in-full-brief"><span className="in-kicker"><FileText size={15}/> FAMILY OPERATING BRIEF · {briefing.asOf}</span>
        <h3>What the records currently support</h3><p>{briefing.summary}</p>
        {([
          ["For review",briefing.attention] as const,
          ["Optional planning ideas",briefing.opportunities] as const,
          ["Coming up",briefing.celebrations] as const
        ]).map(([heading,entries])=><div className="in-brief-section" key={heading}><h4>{heading}</h4>
          {entries.length?entries.map(s=><button key={s.id} onClick={()=>preview(s)}>
            <span className="in-brief-marker"><IconForDomain domain={s.domain}/></span>
            <span><strong>{s.title}</strong><small>{s.summary}</small></span><ChevronRight size={17}/></button>):
            <p className="in-muted">No qualifying entries in this browser snapshot. This is not a wellbeing or safety assessment.</p>}
        </div>)}
        <div className="in-brief-source"><h4>Data coverage & limits</h4>{coverage.map(c=><div key={c.area}><strong>{c.area}</strong><EvidenceBadge status={c.status}/></div>)}</div>
        <label className="in-note-label">Optional reflection note<textarea rows={3} maxLength={350} value={briefNote}
          placeholder="What should the family discuss? Local draft only."
          onChange={e=>setBriefNote(e.target.value)}/></label>
        <button className="in-btn primary" onClick={saveCurrent}><Check size={16}/> Save this snapshot in browser</button>
        <p className="in-muted">Snapshots capture titles and rule fingerprints at a moment in time; they may become stale. Nothing is emailed, announced or approved.</p>
      </section>
      <aside className="in-panel in-saved-briefs"><div className="in-panel-top"><h3>Saved briefings</h3><span className="in-count">{data.intelligence.savedBriefs.length}</span></div>
        {data.intelligence.savedBriefs.map(b=><article className="in-saved-item" key={b.id}><button onClick={()=>setSelectedBrief(b.id)}>
          <FileText size={18}/><span><strong>{b.title}</strong><small>{b.signals.length} source-linked titles · {b.createdAt.slice(0,10)}</small></span>
          <ChevronRight size={16}/></button><button aria-label={"Delete "+b.title} className="in-delete" onClick={()=>
            change(prev=>({...prev,savedBriefs:prev.savedBriefs.filter(x=>x.id!==b.id)}))}><Trash2 size={16}/></button></article>)}
        {!data.intelligence.savedBriefs.length&&<NoEvidence text="No saved family briefs yet. Current insights are always recalculated from the browser's recorded data."/>}
      </aside></div>
    </>}
    {section==="Chief of Staff"&&<>
      <SmallHeader tag="ASSISTED CLARITY · RULE-BASED" title="Family Chief of Staff"
        desc="A transparent prompt-driven assistant. It explains the current family records; it does not use a language model, recall private memories or execute actions."
        action={<button className="in-btn subtle" onClick={()=>{setMessages([]);setAssistantError("");}}><RefreshCw size={16}/> Reset chat</button>}/>
      <div className="in-assistant-grid"><section className="in-panel in-chat">
        <div className="in-chat-header"><div className="in-chat-avatar"><Sparkles size={23}/></div><span>
          <strong>Family Chief of Staff · Prototype</strong><small>Deterministic evidence summaries · no generative AI</small></span>
          <span className="in-online">LOCAL</span></div>
        <div className="in-chat-scroll"><div className="in-chat-bubble assistant"><strong>How can I help you review the family's plans?</strong>
          <p>I can explain dated responsibilities, family coordination, goal targets, decision reviews, traditions and missing evidence. I can't infer anyone's wellbeing or see another person's private data.</p></div>
          {messages.map(msg=><div key={msg.id}><div className="in-chat-bubble human"><p>{msg.question}</p></div>
            <div className="in-chat-bubble assistant"><pre>{msg.answer}</pre>
              {msg.signals.slice(0,3).map(s=><button key={s.id} className="in-chat-cite" onClick={()=>preview(s)}>
                <BookOpen size={14}/>{s.title}<ArrowRight size={14}/></button>)}
              <small>{msg.disclaimer}</small></div></div>)}
        </div>
        <div className="in-prompt-pills">{chiefPrompts.map(p=><button key={p.id} onClick={()=>reply(p.id,p.label)}>{p.label}</button>)}</div>
        <form className="in-chat-input" onSubmit={submitQuestion}><label><MessageCircle size={17}/>
          <input value={draftQuestion} onChange={e=>setDraftQuestion(e.target.value)}
            placeholder="Ask about attention, plans, traditions or data gaps..." maxLength={220} aria-label="Ask the family chief of staff"/></label>
          <button type="submit" aria-label="Send local rule-based question"><ArrowRight size={18}/></button></form>
        {assistantError&&<p className="in-error" role="alert">{assistantError}</p>}
      </section><aside className="in-panel in-assistant-side"><h3>What this assistant can do</h3>
        <div><CheckCircle2 size={18}/><span><strong>Explain observed records</strong><small>Reproduce rules and source IDs behind a signal.</small></span></div>
        <div><BookOpen size={18}/><span><strong>Prepare briefings</strong><small>Summarise recorded plans for human review.</small></span></div>
        <div><HelpCircle size={18}/><span><strong>Show what's unknown</strong><small>Clearly mark missing connections and data gaps.</small></span></div>
        <div><ShieldCheck size={18}/><span><strong>Keep decisions with people</strong><small>Always navigate to the domain owner to take action.</small></span></div>
        <p>Unsupported: open-ended AI chat, forecasts, family wellbeing scores, real identity/consent, private OS data, external calendars, financial advice, child profiling, autonomous actions.</p>
      </aside></div>
    </>}
    {activeDetail&&<div className="in-overlay" onClick={()=>setDetail(null)}><aside role="dialog" aria-modal="true"
      aria-label={"Evidence: "+activeDetail.title} className="in-drawer" onClick={e=>e.stopPropagation()}>
      <div className="in-dialog-head"><span>EVIDENCE & REASONING</span><button aria-label="Close evidence" onClick={()=>setDetail(null)}><X size={20}/></button></div>
      <div className="in-drawer-cover"><IconForDomain domain={activeDetail.domain}/><span>{activeDetail.domain}</span>
        <h2>{activeDetail.title}</h2><ToneBadge tone={activeDetail.tone}/></div>
      <div className="in-drawer-body"><p>{activeDetail.summary}</p><h3>Why you're seeing this</h3>
        <p>{activeDetail.why}</p><div className="in-rule"><span>DETERMINISTIC RULE</span><p>{activeDetail.rule}</p>
          <small>{INTELLIGENCE_VERSION} · evaluated {activeDetail.asOf} · newest source {activeDetail.sourceDate||"not dated"}</small></div>
        <h3>Evidence references</h3>
        {activeDetail.evidence.map(ref=><button className="in-evidence-row" key={ref.domain+"-"+ref.entityId}
          onClick={()=>{setDetail(null);navigate(ref.destination);}}>
          <span><BookOpen size={17}/></span><span><strong>{ref.label}</strong><small>{ref.domain} · {ref.field}: {ref.value} · {ref.date||"no date"}</small></span>
          <ArrowRight size={15}/></button>)}
        <h3>Interpretation limits</h3><p>{activeDetail.limitation}</p>
        <div className="in-caution"><ShieldAlert size={18}/> No model probability, safety verdict, verified access rights or external records.
          This observation is not a decision or instruction.</div>
        <div className="in-drawer-buttons"><button className="in-btn primary" onClick={()=>{setDetail(null);navigate(activeDetail.destination);}}>
          {activeDetail.nextStep}<ArrowRight size={15}/></button>
          <button className="in-btn subtle" onClick={()=>toggleDismiss(activeDetail)}>
            {isDismissed(activeDetail,data.intelligence)?<Eye size={16}/>:<EyeOff size={16}/>}
            {isDismissed(activeDetail,data.intelligence)?"Restore signal":"Hide this evidence version"}</button></div>
        <p className="in-muted">If the underlying evidence changes, this rule may surface the signal again automatically. Hiding never edits the source record.</p>
      </div>
    </aside></div>}
    {activeBrief&&<div className="in-overlay" onClick={()=>setSelectedBrief(null)}><aside role="dialog" aria-modal="true"
      aria-label={"Saved briefing "+activeBrief.title} className="in-drawer" onClick={e=>e.stopPropagation()}>
      <div className="in-dialog-head"><span>SAVED BROWSER SNAPSHOT</span><button onClick={()=>setSelectedBrief(null)}
        aria-label="Close saved briefing"><X size={20}/></button></div>
      <div className="in-drawer-cover saved"><FileText size={29}/><h2>{activeBrief.title}</h2>
        <span>{activeBrief.createdAt.slice(0,10)} · {activeBrief.ruleVersion}</span></div>
      <div className="in-drawer-body"><p>{activeBrief.summary}</p>{activeBrief.signals.map(s=>
        <div className="in-snapshot-entry" key={s.id}><span>{s.tone}</span><strong>{s.title}</strong><small>Stored historical signal · not revalidated</small></div>)}
        {activeBrief.note&&<><h3>Family review note</h3><p>{activeBrief.note}</p></>}
        <div className="in-caution"><Info size={17}/> Historical snapshot only. The current record state may be different.
          Neither a signed briefing nor an approval.</div>
      </div></aside></div>}
    <footer className="in-footer">Family OS · Phase 7 — Evidence-based Intelligence & Insights
      <span>Local deterministic preview · No backend or AI model</span></footer>
  </main>;
}
