/**
 * Phase 7 Family Intelligence: transparent, deterministic, family-scoped projections.
 * No LLM, prediction, external service, private Health/Finance data, or authorization.
 * All recommendations require a human to open the owning workspace and act there.
 */
import type {AppData} from "../data";
import {dateKey,shiftDate,findEventConflicts,taskAnchor} from "../operations/model";
import {nextTraditionDate} from "../life/model";

export const INTELLIGENCE_VERSION="family-rules-v1";
export type SignalDomain="Operations"|"Calendar"|"Goals"|"Decisions"|"Experiences"|"Traditions";
export type SignalTone="ATTENTION"|"OPPORTUNITY"|"CELEBRATE";
export type SignalNature="OBSERVATION"|"RECOMMENDATION";
export type EvidenceRef={
  domain:SignalDomain;entityId:string;label:string;field:string;value:string;
  date:string;destination:string;
};
export type Signal={
  id:string;fingerprint:string;domain:SignalDomain;tone:SignalTone;nature:SignalNature;
  title:string;summary:string;why:string;limitation:string;rule:string;
  sourceDate:string;asOf:string;evidence:EvidenceRef[];
  nextStep:string;destination:string;
};
export type Dismissal={id:string;fingerprint:string;at:string};
export type SavedBrief={
  id:string;createdAt:string;asOf:string;title:string;summary:string;
  signals:{id:string;fingerprint:string;title:string;tone:SignalTone}[];
  note:string;ruleVersion:string;
};
export type IntelligenceState={dismissals:Dismissal[];savedBriefs:SavedBrief[]};
export const seedIntelligence:IntelligenceState={dismissals:[],savedBriefs:[]};
export function migrateIntelligence(raw:unknown):IntelligenceState{
  if(!raw||typeof raw!=="object")return {dismissals:[],savedBriefs:[]};
  const state=raw as Partial<IntelligenceState>;
  return {dismissals:Array.isArray(state.dismissals)?state.dismissals:[],
    savedBriefs:Array.isArray(state.savedBriefs)?state.savedBriefs:[]};
}
export function isDismissed(signal:Signal,state:IntelligenceState):boolean{
  return state.dismissals.some(d=>d.id===signal.id&&d.fingerprint===signal.fingerprint);
}
export function dismissSignal(state:IntelligenceState,signal:Signal,at:string):IntelligenceState{
  return {...state,dismissals:[
    ...state.dismissals.filter(d=>d.id!==signal.id),{id:signal.id,fingerprint:signal.fingerprint,at}
  ]};
}
export function restoreSignal(state:IntelligenceState,id:string):IntelligenceState{
  return {...state,dismissals:state.dismissals.filter(x=>x.id!==id)};
}
const observation=(domain:SignalDomain,id:string,label:string,field:string,value:string,date:string,destination:string):EvidenceRef=>
  ({domain,entityId:id,label,field,value,date,destination});
const build=(detail:Omit<Signal,"fingerprint">):Signal=>({
  ...detail,fingerprint:JSON.stringify(detail.evidence.map(e=>[e.entityId,e.field,e.value,e.date]))
});
const order:Record<SignalTone,number>={ATTENTION:0,OPPORTUNITY:1,CELEBRATE:2};
export function deriveSignals(data:AppData,day=dateKey()):Signal[]{
  const signals:Signal[]=[];
  const upcomingSeven=shiftDate(day,7),upcomingFourteen=shiftDate(day,14);
  const eligibleTask=(category:string|undefined)=>category==="HOME"||category==="FAMILY"||category==="OTHER";
  const publicEvent=(category:string|undefined)=>category==="HOME"||category==="FAMILY";
  const explicitTasks=data.tasks.filter(t=>!t.archived&&eligibleTask(t.category)&&t.dueDate&&
    (!t.repeat||t.repeat==="NONE"));
  const overdue=explicitTasks.filter(t=>!t.done&&taskAnchor(t,day)<day);
  if(overdue.length){
    const e=overdue.map(t=>observation("Operations",t.id,t.title,"dueDate",t.dueDate||"",t.dueDate||"","Responsibilities"));
    signals.push(build({id:"ops-overdue",domain:"Operations",tone:"ATTENTION",nature:"OBSERVATION",
      title:overdue.length+" overdue family responsibilit"+(overdue.length===1?"y":"ies"),
      summary:"Recorded one-time household/family tasks have due dates before today and are still open.",
      why:"These tasks have explicit dates and remain incomplete in the Responsibilities list.",
      limitation:"Unclassified legacy samples, repeating tasks, and health/school/work categories are excluded. No urgency beyond the recorded due dates is inferred.",
      rule:"Explicit due date < as-of date, not completed, non-recurring, shared category.",
      sourceDate:e.map(x=>x.date).sort().pop()||"",asOf:day,evidence:e,
      nextStep:"Review overdue responsibilities",destination:"Responsibilities"}));
  }
  const unassigned=data.tasks.filter(t=>!t.archived&&eligibleTask(t.category)&&
    t.assigneeIds!==undefined&&t.assigneeIds.length===0&&
    (t.dueDate||"")>=day&&(t.dueDate||"")<=upcomingSeven);
  if(unassigned.length){
    const e=unassigned.map(t=>observation("Operations",t.id,t.title,"assigneeIds","0",t.dueDate||"","Responsibilities"));
    signals.push(build({id:"ops-unassigned",domain:"Operations",tone:"OPPORTUNITY",nature:"RECOMMENDATION",
      title:unassigned.length+" upcoming responsibilities without assignees",
      summary:"Dated shared tasks in the next seven days have no selected assignees.",
      why:"The task editor has an explicit empty assignee list for each referenced task.",
      limitation:"Unassigned does not mean someone has agreed to take responsibility. Existing legacy tasks without structured assignees are excluded.",
      rule:"Explicit due date within seven days, and assigneeIds is present and empty.",
      sourceDate:e.map(x=>x.date).sort().pop()||"",asOf:day,evidence:e,
      nextStep:"Review assignments",destination:"Responsibilities"}));
  }
  const collisions=findEventConflicts(data.events.filter(e=>publicEvent(e.category)&&!!e.date),
    day,upcomingSeven,day);
  if(collisions.length){
    const ev=new Map(data.events.map(e=>[e.id,e]));
    const ids=[...new Set(collisions.flatMap(c=>[c.a,c.b]))];
    const e=ids.map(id=>{const row=ev.get(id)!;return observation("Calendar",id,row.title,"date/time",
      (row.date||"")+" "+row.time+(row.endTime?"–"+row.endTime:""),row.date||"","Calendar");});
    signals.push(build({id:"calendar-overlap",domain:"Calendar",tone:"ATTENTION",nature:"OBSERVATION",
      title:collisions.length+" shared calendar overlap"+(collisions.length===1?"":"s"),
      summary:"Two or more upcoming family-labelled calendar events overlap for at least one attendee.",
      why:"The event intervals overlap on the same date and share an attendee ID.",
      limitation:"Only explicitly dated HOME/FAMILY events are checked. No outside calendars, individual free/busy or private events were accessed.",
      rule:"Same date, overlapping start/end intervals, common attendee.",
      sourceDate:e.map(x=>x.date).sort().pop()||"",asOf:day,evidence:e,
      nextStep:"Review family calendar",destination:"Calendar"}));
  }
  const missed=data.goals.filter(g=>g.status!=="ARCHIVED"&&g.status!=="DRAFT"&&
    g.targetDate&&g.targetDate<day&&g.progress<100);
  if(missed.length){
    const e=missed.map(g=>observation("Goals",g.id,g.title,"targetDate/progress",
      (g.targetDate||"")+" · "+g.progress+"%",g.targetDate||"","Goals"));
    signals.push(build({id:"goals-past-target",domain:"Goals",tone:"ATTENTION",nature:"OBSERVATION",
      title:missed.length+" family goal target"+(missed.length===1?"":"s")+" passed",
      summary:"Self-reported goal progress is below 100% after the recorded target date.",
      why:"Goal entries contain an elapsed target date and an incomplete progress percentage.",
      limitation:"Progress is self-reported; it does not verify any financial, educational or health outcome.",
      rule:"Target date < today and goal progress < 100%.",sourceDate:e.map(x=>x.date).sort().pop()||"",
      asOf:day,evidence:e,nextStep:"Review family goals",destination:"Goals"}));
  }
  const comingGoals=data.goals.filter(g=>g.status==="ACTIVE"&&g.targetDate&&
    g.targetDate>=day&&g.targetDate<=upcomingFourteen&&g.progress<100);
  if(comingGoals.length){
    const e=comingGoals.map(g=>observation("Goals",g.id,g.title,"targetDate/progress",
      (g.targetDate||"")+" · "+g.progress+"%",g.targetDate||"","Goals"));
    signals.push(build({id:"goals-upcoming",domain:"Goals",tone:"OPPORTUNITY",nature:"RECOMMENDATION",
      title:comingGoals.length+" family goal deadline"+(comingGoals.length===1?"":"s")+" approaching",
      summary:"A recorded goal target falls within the next 14 days and is not marked complete.",
      why:"A date-based reminder can help the family review a goal's next steps.",
      limitation:"No predicted outcome or probability of completion is available.",
      rule:"Active goal; deadline within 14 days; self-reported progress < 100%.",
      sourceDate:e.map(x=>x.date).sort().pop()||"",asOf:day,evidence:e,
      nextStep:"Review strategy and goals",destination:"Goals"}));
  }
  const unresolved=data.governance.decisions.filter(d=>d.status==="OPEN"||d.status==="APPROVAL_PENDING");
  if(unresolved.length){
    const e=unresolved.map(d=>observation("Decisions",d.id,d.title,"status",d.status,d.createdAt,"Decisions"));
    signals.push(build({id:"decisions-awaiting",domain:"Decisions",tone:"OPPORTUNITY",nature:"RECOMMENDATION",
      title:unresolved.length+" family proposal"+(unresolved.length===1?"":"s")+" awaiting input",
      summary:"Local governance records have not reached a resolved or declined outcome.",
      why:"The decisions remain in open voting or named-reviewer states.",
      limitation:"Votes, membership and approvals are unverified browser simulations, not actual authority.",
      rule:"Decision status is OPEN or APPROVAL_PENDING.",
      sourceDate:e.map(x=>x.date).sort().pop()||"",asOf:day,evidence:e,
      nextStep:"Open decision center",destination:"Decisions"}));
  }
  const exp=data.life.experiences.filter(e=>!e.archived&&e.status==="PLANNED"&&!e.linkedEventId&&
    e.date&&e.date>=day&&e.date<=upcomingFourteen);
  if(exp.length){
    const e=exp.map(x=>observation("Experiences",x.id,x.title,"date/calendar-link",
      x.date+" · not linked",x.date,"Experiences"));
    signals.push(build({id:"experiences-not-on-calendar",domain:"Experiences",tone:"OPPORTUNITY",nature:"RECOMMENDATION",
      title:exp.length+" upcoming experience"+(exp.length===1?"":"s")+" not on the family calendar",
      summary:"Planned experiences in the next 14 days have no linked family calendar entry.",
      why:"Their dates are recorded, but linkedEventId is empty.",
      limitation:"Calendar entry creation is optional and must be explicitly approved in Experiences.",
      rule:"PLANNED experience within 14 days, no linked event.",
      sourceDate:e.map(x=>x.date).sort().pop()||"",asOf:day,evidence:e,
      nextStep:"Review experiences",destination:"Experiences"}));
  }
  const traditions=data.life.traditions.map(t=>({tradition:t,next:nextTraditionDate(t,day)}))
    .filter((r):r is {tradition:typeof data.life.traditions[number];next:string}=>!!r.next&&r.next<=upcomingSeven);
  if(traditions.length){
    const e=traditions.map(({tradition:t,next})=>observation("Traditions",t.id,t.title,"next occurrence",next,next,"Traditions"));
    signals.push(build({id:"traditions-coming",domain:"Traditions",tone:"CELEBRATE",nature:"OBSERVATION",
      title:traditions.length+" family tradition"+(traditions.length===1?"":"s")+" coming up",
      summary:"Based on explicitly configured weekly, monthly or yearly recurrence rules.",
      why:"The next dates are calculated from each active tradition's cadence.",
      limitation:"These are calendar calculations, not confirmed attendance, reminders or completed events.",
      rule:"Next recurring tradition date falls within the next seven days.",
      sourceDate:e.map(x=>x.date).sort().pop()||"",asOf:day,evidence:e,
      nextStep:"Open family traditions",destination:"Traditions"}));
  }
  return signals.sort((a,b)=>order[a.tone]-order[b.tone]||a.id.localeCompare(b.id));
}
export type Availability={area:string;status:"RECORDED_ONLY"|"INSUFFICIENT_DATA"|"NOT_CONNECTED";detail:string;route:string};
export function evidenceCoverage(data:AppData):Availability[]{
  const taskEvidence=data.tasks.some(t=>!!t.dueDate&&!t.archived);
  const goalEvidence=data.goals.some(g=>!!g.targetDate&&g.status!=="ARCHIVED");
  const datedEvents=data.events.some(e=>!!e.date&&e.status!=="CANCELLED");
  return [
    {area:"Family coordination",status:taskEvidence||datedEvents?"RECORDED_ONLY":"INSUFFICIENT_DATA",
      detail:"Dated responsibilities and family calendar entries only; no external calendars or availability.",route:"Plan"},
    {area:"Goals & strategy",status:goalEvidence?"RECORDED_ONLY":"INSUFFICIENT_DATA",
      detail:"Goal dates and self-reported progress; no independent outcome verification.",route:"Goals"},
    {area:"Decision governance",status:data.governance.decisions.length?"RECORDED_ONLY":"INSUFFICIENT_DATA",
      detail:"Local proposal/voting records only; identities and approvals are not verified.",route:"Decisions"},
    {area:"Finance OS",status:"NOT_CONNECTED",detail:"No financial balances, expenditures, savings or forecasts are available.",route:"Insights"},
    {area:"Health / Nutrition OS",status:"NOT_CONNECTED",detail:"No personal health, wellness or diet data is accessed.",route:"Insights"},
    {area:"Personal Kernel / HumanKernelOS",status:"NOT_CONNECTED",
      detail:"No individual schedule authority, consent exchange or cross-OS identity is connected.",route:"Insights"}
  ];
}
export type Briefing={asOf:string;summary:string;attention:Signal[];opportunities:Signal[];
  celebrations:Signal[];coverage:Availability[];ruleVersion:string};
export function createBriefing(data:AppData,day=dateKey()):Briefing{
  const signals=deriveSignals(data,day);
  const attention=signals.filter(s=>s.tone==="ATTENTION"),opportunities=signals.filter(s=>s.tone==="OPPORTUNITY");
  const celebrations=signals.filter(s=>s.tone==="CELEBRATE");
  return {asOf:day,attention,opportunities,celebrations,coverage:evidenceCoverage(data),
    summary:signals.length?
      attention.length+" dated attention item(s), "+opportunities.length+" planning suggestion(s), and "+
      celebrations.length+" upcoming tradition reminder(s), all based on available browser records.":
      "No rule-matched family signals in this browser snapshot. That does not mean everything is okay.",
    ruleVersion:INTELLIGENCE_VERSION};
}
export type ChiefPrompt="attention"|"plans"|"positive"|"gaps";
export const chiefPrompts:{id:ChiefPrompt;label:string}[]=[
  {id:"attention",label:"What needs attention?"},
  {id:"plans",label:"What can we plan next?"},
  {id:"positive",label:"What is worth celebrating?"},
  {id:"gaps",label:"What don't we know yet?"}
];
export function chiefOfStaffReply(data:AppData,prompt:ChiefPrompt,day=dateKey()):{
  heading:string;body:string;signals:Signal[];disclaimer:string;
}{
  const b=createBriefing(data,day),coverage=b.coverage.filter(c=>c.status!=="RECORDED_ONLY");
  if(prompt==="gaps")return {heading:"Known information gaps",body:coverage.map(c=>c.area+": "+c.detail).join("\n"),
    signals:[],disclaimer:"Missing connections are not evidence of good or poor family outcomes."};
  const signals=prompt==="attention"?b.attention:prompt==="plans"?b.opportunities:b.celebrations;
  const label=prompt==="attention"?"Items with dated evidence":prompt==="plans"?"Optional planning suggestions":"Upcoming rituals from recorded rules";
  return {heading:label,body:signals.length?
    signals.map(s=>"• "+s.title+": "+s.summary).join("\n"):
    "No matching signals in the records currently visible to this browser. There may still be unmet needs.",
    signals,disclaimer:"Rule-based explanation only. No AI model, private-data retrieval, approved actions or cross-OS integrations."};
}
export function saveBriefing(state:IntelligenceState,briefing:Briefing,createdAt:string,note=""):IntelligenceState {
  const snapshot:SavedBrief={
    id:"brief-"+createdAt+"-"+String(state.savedBriefs.length+1),createdAt,asOf:briefing.asOf,
    title:"Family briefing · "+briefing.asOf,summary:briefing.summary,
    signals:[...briefing.attention,...briefing.opportunities,...briefing.celebrations]
      .map(s=>({id:s.id,fingerprint:s.fingerprint,title:s.title,tone:s.tone})),
    note:note.trim(),ruleVersion:briefing.ruleVersion
  };
  return {...state,savedBriefs:[snapshot,...state.savedBriefs].slice(0,40)};
}
