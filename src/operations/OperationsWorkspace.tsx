import { useMemo, useState, useEffect, type FormEvent } from "react";
import {
  ArrowRight, CalendarDays, Check, CheckCheck,
  ChevronLeft, ChevronRight, Circle, Clock3, Edit3, HeartHandshake, Info,
  ListChecks, MapPin, Megaphone, Pause, Pin, Plus, Repeat2, Search,
  ShieldCheck, Sparkles, Trash2, TriangleAlert, UsersRound, X
} from "lucide-react";
import type { AppData, Member, PlanEvent, Task } from "../data";
import { activeMembers, freshId } from "../family/model";
import type { Category, FamilyNote, Priority, Repeat, Routine } from "./model";
import {
  categoryLabels, clockDisplay, completedRoutine, dateKey, dateLabel, dateParts, dayOfWeek,
  eventDate, eventsBetween, eventsOnDate, findEventConflicts, monthGrid,
  parseClock, repeatLabels, repeatsOn, routinesOnDate, scheduledRoutine, shiftDate, startOfWeek,
  taskAnchor, taskDoneOn, taskLoadByMember, tasksOnDate, toggleRoutineDay,
  toggleRoutineStep, toggleTaskForDate, weekDays
} from "./model";
import "./operations.css";
type Section = "Plan" | "Calendar" | "Responsibilities" | "Routines";
type Props = {
  route: Section; data: AppData; onChange: (fn:(prev:AppData)=>AppData)=>void;
  onToast:(message:string)=>void; navigate:(route:string)=>void; initialAction?:"Task"|"Event"|null;
  onInitialActionConsumed?:()=>void;
};
type TaskDraft = { title:string; description:string; category:Category; dueDate:string; assigneeIds:string[]; householdId:string; priority:Priority; repeat:Repeat };
type EventDraft = { title:string; note:string; date:string; time:string; endTime:string; location:string; attendees:string[]; householdId:string; category:Category };
type RoutineDraft = { name:string; description:string; time:string; repeat:"DAILY"|"WEEKDAYS"|"WEEKLY"; weekday:number; householdId:string; memberIds:string[]; stepsText:string; startDate:string };
type NoteDraft = { title:string; body:string; householdId:string; ownerId:string };
type ModalKind = "Task"|"Event"|"Routine"|"Note";
const today=dateKey();
const categories=Object.keys(categoryLabels) as Category[];
const taskRepeats=Object.keys(repeatLabels) as Repeat[];
const categoryTones:Record<Category,string>={HOME:"sky",SCHOOL:"purple",HEALTH:"mint",FAMILY:"rose",WORK:"apricot",OTHER:"slate"};
const defaultTask=():TaskDraft=>({title:"",description:"",category:"HOME",dueDate:today,assigneeIds:[],householdId:"",priority:"MEDIUM",repeat:"NONE"});
const defaultEvent=():EventDraft=>({title:"",note:"",date:today,time:"17:00",endTime:"18:00",location:"",attendees:[],householdId:"",category:"FAMILY"});
const defaultRoutine=():RoutineDraft=>({name:"",description:"",time:"07:00",repeat:"DAILY",weekday:1,householdId:"",memberIds:[],stepsText:"",startDate:today});
const defaultNote=():NoteDraft=>({title:"",body:"",householdId:"",ownerId:""});
function memberLabels(members:Member[],ids:string[]):string {
  return ids.length?ids.map(id=>members.find(m=>m.id===id)?.name||"Member").join(", "):"Unassigned";
}
function tagClass(tone:string){return "ops-tag ops-"+tone;}
function MemberDots({ids,members}:{ids:string[];members:Member[]}) {
  return <span className="ops-people" aria-label={memberLabels(members,ids)}>{ids.slice(0,4).map(id=>{
    const m=members.find(x=>x.id===id);
    return m?<span title={m.name} key={id} style={{background:m.color}}>{m.name.charAt(0)}</span>:null;
  })}{ids.length>4&&<b>+{ids.length-4}</b>}</span>;
}
function SectionHead({kicker,title,description,action}:{
  kicker:string;title:string;description:string;action?:React.ReactNode
}){
  return <div className="ops-section-head"><div><div className="ops-eyebrow">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action&&<div className="ops-head-actions">{action}</div>}</div>;
}
function CardHead({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}){
  return <div className="ops-card-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>;
}
function Empty({title,copy,action}:{title:string;copy:string;action?:React.ReactNode}){
  return <div className="ops-empty"><Sparkles size={29}/><h3>{title}</h3><p>{copy}</p>{action}</div>;
}
function Field({name,children}:{name:string;children:React.ReactNode}){
  return <label className="ops-field"><span>{name}</span>{children}</label>;
}
function Participants({value,all,onChange}:{value:string[];all:Member[];onChange:(v:string[])=>void}){
  return <div className="ops-participants">{all.map(m=><label key={m.id} className={value.includes(m.id)?"selected":""}>
    <input type="checkbox" checked={value.includes(m.id)} onChange={e=>onChange(e.target.checked?[...value,m.id]:value.filter(id=>id!==m.id))}/>{m.name}</label>)}</div>;
}
export default function OperationsWorkspace({route,data,onChange,onToast,navigate,initialAction,onInitialActionConsumed}:Props) {
  const [selectedDay,setSelectedDay]=useState(today);
  const [focusMonth,setFocusMonth]=useState(today.slice(0,7)+"-01");
  const [calendarView,setCalendarView]=useState<"MONTH"|"WEEK">("MONTH");
  const [search,setSearch]=useState("");
  const [houseFilter,setHouseFilter]=useState("ALL");
  const [personFilter,setPersonFilter]=useState("ALL");
  const [taskFilter,setTaskFilter]=useState<"ALL"|"OPEN"|"DONE"|"ARCHIVED">("OPEN");
  const [modal,setModal]=useState<ModalKind|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [taskDraft,setTaskDraft]=useState<TaskDraft>(defaultTask);
  const [eventDraft,setEventDraft]=useState<EventDraft>(defaultEvent);
  const [routineDraft,setRoutineDraft]=useState<RoutineDraft>(defaultRoutine);
  const [noteDraft,setNoteDraft]=useState<NoteDraft>(defaultNote);
  const [formError,setFormError]=useState("");
  const [showArchivedRoutines,setShowArchivedRoutines]=useState(false);
  const members=activeMembers(data.members,data.family);
  const houses=data.family.households.filter(h=>h.status==="ACTIVE");
  const primaryHouse=houses.find(h=>h.isPrimary)?.id||houses[0]?.id||"";
  const collisions=useMemo(()=>findEventConflicts(data.events,selectedDay,shiftDate(selectedDay,6)),[data.events,selectedDay]);
  const eventsToday=eventsOnDate(data.events,selectedDay);
  const todayTasks=tasksOnDate(data.tasks,selectedDay);
  const todayRoutines=routinesOnDate(data.operations.routines,selectedDay);
  const unassigned=todayTasks.filter(t=>(t.assigneeIds||[]).length===0&&!taskDoneOn(t,selectedDay));
  const totalPending=todayTasks.filter(t=>!taskDoneOn(t,selectedDay)).length;
  const load=taskLoadByMember(data.tasks,members.map(m=>m.id),selectedDay);
  const displayMonth=new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(focusMonth+"T12:00:00Z"));
  const weekStart=startOfWeek(selectedDay);
  const weekDaysInView=Array.from({length:7},(_,i)=>shiftDate(weekStart,i));
  const visibleEvents=calendarView==="MONTH"?monthGrid(focusMonth):weekDaysInView;
  const dayEventsInWeek=eventsBetween(data.events,weekStart,shiftDate(weekStart,6));
  const notes=data.operations.notes.filter(n=>!n.archived).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.createdAt.localeCompare(a.createdAt));
  const taskScope=data.tasks.filter(t=>{
    if(taskFilter==="ARCHIVED")return !!t.archived;
    if(t.archived)return false;
    if(taskFilter==="OPEN"&&taskDoneOn(t,selectedDay))return false;
    if(taskFilter==="DONE"&&!taskDoneOn(t,selectedDay))return false;
    if(personFilter!=="ALL"&&!(t.assigneeIds||[]).includes(personFilter))return false;
    if(houseFilter!=="ALL"&&t.householdId!==houseFilter)return false;
    return (t.title+" "+t.description+" "+t.person).toLowerCase().includes(search.toLowerCase());
  });
  const needsAttention=(t:Task)=>t.priority==="HIGH"||(
    (!t.repeat||t.repeat==="NONE")&&taskAnchor(t)<today);
  const groupedTasks:Record<string,Task[]>={
    "Needs attention":taskScope.filter(t=>!taskDoneOn(t,selectedDay)&&!t.archived&&needsAttention(t)),
    "To do":taskScope.filter(t=>!taskDoneOn(t,selectedDay)&&!t.archived&&!needsAttention(t)),
    "Completed":taskScope.filter(t=>taskDoneOn(t,selectedDay)&&!t.archived),
    "Archived":taskScope.filter(t=>!!t.archived)
  };

  useEffect(()=>{
    if(initialAction==="Task")openCreate("Task");
    if(initialAction==="Event")openCreate("Event");
    if(initialAction)onInitialActionConsumed?.();
  // only intentionally consume when a new external action arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[initialAction]);
  useEffect(()=>{
    function closeOnEscape(e:KeyboardEvent){if(e.key==="Escape")setModal(null);}
    window.addEventListener("keydown",closeOnEscape);
    return ()=>window.removeEventListener("keydown",closeOnEscape);
  },[]);
  function update(fn:(prev:AppData)=>AppData){onChange(fn);}
  function openCreate(kind:ModalKind) {
    setModal(kind);setEditingId(null);setFormError("");
    setTaskDraft({...defaultTask(),householdId:primaryHouse});
    setEventDraft({...defaultEvent(),date:selectedDay,householdId:primaryHouse});
    setRoutineDraft({...defaultRoutine(),householdId:primaryHouse,startDate:selectedDay});
    setNoteDraft({...defaultNote(),householdId:primaryHouse,ownerId:members[0]?.id||""});
  }
  function openTask(t:Task){
    setEditingId(t.id);setModal("Task");setFormError("");
    setTaskDraft({title:t.title,description:t.description||"",category:t.category||"HOME",
      dueDate:taskAnchor(t),assigneeIds:t.assigneeIds||[],householdId:t.householdId||"",
      priority:t.priority||"MEDIUM",repeat:t.repeat||"NONE"});
  }
  function openEvent(e:PlanEvent){
    setEditingId(e.id);setModal("Event");setFormError("");
    setEventDraft({title:e.title,note:e.note,date:eventDate(e),time:clock24(e.time),
      endTime:e.endTime||clock24Minutes(parseClock(e.time)+60),location:e.location||"",
      attendees:[...e.attendees],householdId:e.householdId||"",category:e.category||"FAMILY"});
  }
  function openRoutine(r:Routine){
    setEditingId(r.id);setModal("Routine");setFormError("");
    setRoutineDraft({name:r.name,description:r.description,time:r.time,repeat:r.repeat,
      weekday:r.weekday,householdId:r.householdId,memberIds:[...r.memberIds],
      stepsText:r.steps.map(s=>s.text).join("\n"),startDate:r.startDate});
  }
  function openNote(n:FamilyNote){
    setEditingId(n.id);setModal("Note");setFormError("");
    setNoteDraft({title:n.title,body:n.body,householdId:n.householdId,ownerId:n.ownerId});
  }
  function clock24(s:string):string {return clock24Minutes(parseClock(s));}
  function clock24Minutes(min:number):string{return String(Math.floor((min%1440)/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0");}
  function saveTask(e:FormEvent){
    e.preventDefault();
    const name=taskDraft.title.trim();
    if(!name){setFormError("Add a responsibility title.");return;}
    if(taskDraft.dueDate<"2000-01-01"){setFormError("Choose a valid due date.");return;}
    const person=memberLabels(data.members,taskDraft.assigneeIds);
    if(editingId)update(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===editingId?{
      ...t,title:name,description:taskDraft.description.trim(),category:taskDraft.category,
      dueDate:taskDraft.dueDate,due:dateLabel(taskDraft.dueDate),assigneeIds:taskDraft.assigneeIds,
      person,householdId:taskDraft.householdId,priority:taskDraft.priority,repeat:taskDraft.repeat,
      completedDates:t.repeat===taskDraft.repeat?t.completedDates:[]
    }:t)}));
    else {
      const next:Task={id:freshId("task-"),title:name,description:taskDraft.description.trim(),
        category:taskDraft.category,dueDate:taskDraft.dueDate,due:dateLabel(taskDraft.dueDate),
        person,assigneeIds:taskDraft.assigneeIds,householdId:taskDraft.householdId,
        priority:taskDraft.priority,repeat:taskDraft.repeat,done:false,completedDates:[],archived:false};
      update(prev=>({...prev,tasks:[next,...prev.tasks]}));
    }
    setModal(null);onToast(editingId?"Responsibility updated":"Responsibility added to the family plan");
  }
  function saveEvent(e:FormEvent){
    e.preventDefault();
    if(!eventDraft.title.trim()){setFormError("Add an event title.");return;}
    if(!eventDraft.date){setFormError("Choose an event date.");return;}
    if(parseClock(eventDraft.endTime)<=parseClock(eventDraft.time)){setFormError("End time must follow start time.");return;}
    const values={
      title:eventDraft.title.trim(),note:eventDraft.note.trim(),
      date:eventDraft.date,time:eventDraft.time,endTime:eventDraft.endTime,
      location:eventDraft.location.trim(),householdId:eventDraft.householdId,
      category:eventDraft.category,attendees:eventDraft.attendees,color:"#8bbdf6",status:"ACTIVE" as const
    };
    if(editingId)update(prev=>({...prev,events:prev.events.map(ev=>ev.id===editingId?{...ev,...values}:ev)}));
    else update(prev=>({...prev,events:[...prev.events,{id:freshId("event-"),...values}]}));
    setSelectedDay(eventDraft.date);setFocusMonth(eventDraft.date.slice(0,7)+"-01");
    setModal(null);onToast(editingId?"Event updated":"Event added to shared family calendar");
  }
  function saveRoutine(e:FormEvent){
    e.preventDefault();
    const texts=routineDraft.stepsText.split("\n").map(x=>x.trim()).filter(Boolean);
    if(!routineDraft.name.trim()){setFormError("Name your routine.");return;}
    if(!texts.length){setFormError("Add at least one step, each on its own line.");return;}
    if(texts.length>20){setFormError("Keep routines to 20 steps or fewer.");return;}
    const previous=data.operations.routines.find(r=>r.id===editingId);
    const steps=texts.map((text,index)=>({
      id:previous?.steps[index]?.text===text?previous.steps[index].id:freshId("step-"),text
    }));
    const value:Routine={
      id:editingId||freshId("routine-"),name:routineDraft.name.trim(),
      description:routineDraft.description.trim(),repeat:routineDraft.repeat,
      time:routineDraft.time,weekday:routineDraft.weekday,householdId:routineDraft.householdId,
      memberIds:routineDraft.memberIds,startDate:routineDraft.startDate,steps,
      active:previous?.active??true,completedByDate:previous?.completedByDate||{},skippedDates:previous?.skippedDates||[]
    };
    update(prev=>({...prev,operations:{...prev.operations,routines:
      editingId?prev.operations.routines.map(r=>r.id===editingId?value:r):[...prev.operations.routines,value]}}));
    setModal(null);onToast(editingId?"Routine updated":"Family routine created");
  }
  function saveNote(e:FormEvent){
    e.preventDefault();
    if(!noteDraft.title.trim()||!noteDraft.body.trim()){setFormError("Provide a title and note.");return;}
    const value:FamilyNote={
      id:editingId||freshId("note-"),title:noteDraft.title.trim(),body:noteDraft.body.trim(),
      householdId:noteDraft.householdId,ownerId:noteDraft.ownerId,
      pinned:data.operations.notes.find(n=>n.id===editingId)?.pinned||false,
      createdAt:data.operations.notes.find(n=>n.id===editingId)?.createdAt||today,archived:false
    };
    update(prev=>({...prev,operations:{...prev.operations,notes:
      editingId?prev.operations.notes.map(n=>n.id===editingId?value:n):[value,...prev.operations.notes]}}));
    setModal(null);onToast(editingId?"Family note updated":"Shared family note added");
  }
  function markTask(t:Task,day=selectedDay){
    update(prev=>({...prev,tasks:prev.tasks.map(x=>x.id===t.id?toggleTaskForDate(x,day):x)}));
    onToast(taskDoneOn(t,day)?"Marked as not complete":"Responsibility completed");
  }
  function toggleRun(r:Routine,stepId?:string){
    update(prev=>({...prev,operations:{...prev.operations,routines:prev.operations.routines.map(x=>x.id===r.id
      ?stepId?toggleRoutineStep(x,selectedDay,stepId):toggleRoutineDay(x,selectedDay):x)}}));
  }
  function changeRoutineActive(r:Routine){
    update(prev=>({...prev,operations:{...prev.operations,routines:prev.operations.routines.map(x=>x.id===r.id?{...x,active:!x.active}:x)}}));
    onToast(r.active?"Routine paused":"Routine reactivated");
  }
  function cancelEvent(e:PlanEvent){
    update(prev=>({...prev,events:prev.events.map(x=>x.id===e.id?{...x,status:"CANCELLED" as const}:x)}));
    onToast("Event cancelled in this browser");
  }
  function archiveTask(t:Task){
    update(prev=>({...prev,tasks:prev.tasks.map(x=>x.id===t.id?{...x,archived:!x.archived}:x)}));
    onToast(t.archived?"Responsibility restored":"Responsibility archived");
  }
  function togglePin(n:FamilyNote){
    update(prev=>({...prev,operations:{...prev.operations,notes:prev.operations.notes.map(x=>x.id===n.id?{...x,pinned:!x.pinned}:x)}}));
  }
  function archiveNote(n:FamilyNote){
    update(prev=>({...prev,operations:{...prev.operations,notes:prev.operations.notes.map(x=>x.id===n.id?{...x,archived:true}:x)}}));
    onToast("Note archived");
  }
  function householdLabel(id:string){return houses.find(h=>h.id===id)?.name||"All households";}
  function jumpDay(d:string){setSelectedDay(d);setFocusMonth(d.slice(0,7)+"-01");}
  function calendarMonthBy(diff:number){
    const {year,month}=dateParts(focusMonth);
    const next=new Date(Date.UTC(+year,month-1+diff,1)).toISOString().slice(0,10);
    setFocusMonth(next);setSelectedDay(next);
  }
  const openCount=Object.values(load).reduce((a,b)=>a+b,0);
  return <main className="ops-workspace">
    <div className="ops-breadcrumb"><button onClick={()=>navigate("Dashboard")}>Dashboard</button><ChevronRight size={14}/><span>Family Operations</span><ChevronRight size={14}/><strong>{route}</strong></div>
    <div className="ops-hero"><div className="ops-hero-decoration"><div/><div/></div>
      <div className="ops-hero-text"><span><Sparkles size={14}/> FAMILY OPERATIONS</span>
        <h1>Make every day work <em>beautifully together.</em></h1>
        <p>One calm space for shared schedules, meaningful responsibilities, and family rhythms.</p></div>
      <div className="ops-hero-actions"><button onClick={()=>openCreate("Event")}><CalendarDays size={17}/> Add event</button><button onClick={()=>openCreate("Task")}><Plus size={18}/> New responsibility</button></div>
    </div>
    <div className="ops-preview-warning"><Info size={16}/> Frontend-only preview. Demo events and notes are fictional, stored in this browser. No live scheduling, automatic reminders, shared syncing, or enforced permissions.</div>
    <div className="ops-top-stats">
      <button onClick={()=>navigate("Calendar")}><span className="ops-stat-icon ops-sky"><CalendarDays size={21}/></span><span><b>{eventsToday.length}</b><small>Events on selected day</small></span></button>
      <button onClick={()=>navigate("Responsibilities")}><span className="ops-stat-icon ops-purple"><ListChecks size={21}/></span><span><b>{totalPending}</b><small>Open responsibilities</small></span></button>
      <button onClick={()=>navigate("Routines")}><span className="ops-stat-icon ops-mint"><Repeat2 size={21}/></span><span><b>{todayRoutines.filter(r=>completedRoutine(r,selectedDay)).length}<em> / {todayRoutines.length}</em></b><small>Routines completed</small></span></button>
      <button onClick={()=>navigate("Plan")}><span className="ops-stat-icon ops-rose"><UsersRound size={21}/></span><span><b>{unassigned.length}</b><small>Unassigned today</small></span></button>
    </div>
    <nav className="ops-tabs" aria-label="Operations sections">{(["Plan","Calendar","Responsibilities","Routines"] as Section[]).map(v=>
      <button key={v} aria-current={route===v?"page":undefined} className={route===v?"selected":""} onClick={()=>navigate(v)}>
        {v==="Plan"?<HeartHandshake size={17}/>:v==="Calendar"?<CalendarDays size={17}/>:v==="Responsibilities"?<ListChecks size={17}/>:<Repeat2 size={17}/>} {v}</button>)}</nav>

    {route==="Plan"&&<>
      <SectionHead kicker="THIS WEEK · FAMILY HQ" title="Family Coordination" description="The whole family's practical next steps — without overwhelm."
        action={<div className="ops-date-nav"><button aria-label="Previous day" onClick={()=>jumpDay(shiftDate(selectedDay,-1))}><ChevronLeft size={18}/></button><label className="ops-date-label"><CalendarDays size={17}/><input type="date" aria-label="Select coordination date" value={selectedDay} onChange={e=>e.target.value&&jumpDay(e.target.value)}/></label><button aria-label="Next day" onClick={()=>jumpDay(shiftDate(selectedDay,1))}><ChevronRight size={18}/></button></div>}/>
      <div className="ops-plan-grid">
        <section className="ops-panel ops-today-focus">
          <CardHead title={"Your Family Day · "+dateLabel(selectedDay)} subtitle="A clear plan, from morning to evening."
            action={<button className="ops-link" onClick={()=>navigate("Calendar")}>Full calendar <ArrowRight size={15}/></button>}/>
          <div className="ops-focus-list">{eventsToday.map(ev=><button key={ev.id} className="ops-focus-event" onClick={()=>openEvent(ev)}>
            <time>{clockDisplay(ev.time)}</time><span className="ops-focus-marker" style={{background:ev.color}}/><span><b>{ev.title}</b><small>{ev.note||memberLabels(data.members,ev.attendees)}</small></span><ChevronRight size={15}/></button>)}
          {!eventsToday.length&&<Empty title="A little breathing room" copy="No calendar events for this date." action={<button className="ops-link" onClick={()=>openCreate("Event")}>Add an event <Plus size={14}/></button>}/>}</div>
          <div className="ops-divider"/>
          <div className="ops-subheader"><strong>Responsibilities today</strong><button className="ops-link" onClick={()=>navigate("Responsibilities")}>All tasks <ArrowRight size={14}/></button></div>
          {todayTasks.slice(0,5).map(t=><div className="ops-focus-task" key={t.id}>
            <button className={"ops-check "+(taskDoneOn(t,selectedDay)?"done":"")} onClick={()=>markTask(t)} aria-label={"Toggle "+t.title}>{taskDoneOn(t,selectedDay)&&<Check size={15}/>}</button>
            <span><b>{t.title}</b><small>{t.person}</small></span><span className={tagClass(categoryTones[t.category||"HOME"])}>{categoryLabels[t.category||"HOME"]}</span>
          </div>)}
          {!todayTasks.length&&<p className="ops-dim">No responsibilities on this day.</p>}
        </section>
        <div className="ops-plan-side">
          <section className="ops-panel">
            <CardHead title="Family Rhythms" subtitle="Small routines make a big difference."
              action={<button className="ops-link" onClick={()=>navigate("Routines")}>View all <ArrowRight size={15}/></button>}/>
            {todayRoutines.slice(0,3).map(r=><button className="ops-routine-mini" key={r.id} onClick={()=>navigate("Routines")}>
              <span className={"ops-mini-state "+(completedRoutine(r,selectedDay)?"finished":"")}><Check size={16}/></span>
              <span><b>{r.name}</b><small>{clockDisplay(r.time)} · {(r.completedByDate[selectedDay]||[]).length}/{r.steps.length} steps</small></span><ChevronRight size={16}/></button>)}
            {!todayRoutines.length&&<p className="ops-dim">No active routines for this day.</p>}
          </section>
          <section className="ops-panel">
            <CardHead title="Family Load" subtitle="A snapshot of assigned, unfinished work."/>
            {members.length?members.map(m=><div className="ops-load-row" key={m.id}><span className="ops-initial" style={{background:m.color}}>{m.name[0]}</span>
              <span>{m.name}</span><div className="ops-load-track"><i style={{width:(openCount?Math.max(6,(load[m.id]||0)/Math.max(1,...Object.values(load))*100):0)+"%"}}/></div><b>{load[m.id]||0}</b></div>):
              <p className="ops-dim">Add family members to see workload distribution.</p>}
            <p className="ops-small-print">Counts are task assignments only, not a measure of someone's contribution.</p>
          </section>
          {collisions.length>0&&<section className="ops-panel ops-conflict-panel"><CardHead title="Schedule Overlaps" subtitle="Shared attendees have overlapping time blocks."/>
            {collisions.slice(0,4).map((collision,i)=><div key={i} className="ops-conflict-row"><TriangleAlert size={18}/>
              <span>{data.events.find(e=>e.id===collision.a)?.title} and {data.events.find(e=>e.id===collision.b)?.title}
                <small>{dateLabel(collision.date)} · {memberLabels(data.members,collision.attendeeIds)}</small></span></div>)}</section>}
        </div>
      </div>
      <section className="ops-panel ops-coordination">
        <CardHead title="Family Huddle" subtitle="Shared notes for smoother coordination. Local notes only."
          action={<button className="ops-btn primary" onClick={()=>openCreate("Note")}><Plus size={16}/> Add note</button>}/>
        <div className="ops-notes-grid">{notes.map(note=><article className="ops-note" key={note.id}>
          <span className="ops-note-pin">{note.pinned?<Pin size={16} fill="currentColor"/>:<Megaphone size={16}/>} {note.pinned?"PINNED":"FAMILY NOTE"}</span>
          <h3>{note.title}</h3><p>{note.body}</p>
          <div className="ops-note-footer"><small>{data.members.find(m=>m.id===note.ownerId)?.name||"Family"} · {householdLabel(note.householdId)}</small>
            <div><button onClick={()=>togglePin(note)} title={note.pinned?"Unpin note":"Pin note"} aria-label={note.pinned?"Unpin note":"Pin note"}><Pin size={15}/></button>
              <button onClick={()=>openNote(note)} aria-label={"Edit "+note.title}><Edit3 size={15}/></button>
              <button onClick={()=>archiveNote(note)} aria-label={"Archive "+note.title}><Trash2 size={15}/></button></div>
          </div></article>)}
          <button className="ops-add-tile" onClick={()=>openCreate("Note")}><Plus size={25}/><strong>Add a family note</strong><small>One place for the little things everyone should remember.</small></button>
        </div>
      </section>
    </>}

    {route==="Calendar"&&<>
      <SectionHead kicker="SHARED FAMILY CALENDAR" title="Everyone's time, together." description="Explore shared events and coordinate plans across the household."
        action={<button className="ops-btn primary" onClick={()=>openCreate("Event")}><Plus size={17}/> Add family event</button>}/>
      <div className="ops-calendar-grid">
        <section className="ops-panel ops-calendar-main">
          <div className="ops-calendar-toolbar"><div><h2>{calendarView==="MONTH"?displayMonth:"Week of "+dateLabel(weekStart)}</h2>
            <span>Local family calendar · no external sync</span></div>
            <div className="ops-calendar-controls"><button onClick={()=>{jumpDay(today);setFocusMonth(today.slice(0,7)+"-01");}}>Today</button>
              <button aria-label="Previous" onClick={()=>calendarView==="MONTH"?calendarMonthBy(-1):jumpDay(shiftDate(selectedDay,-7))}><ChevronLeft size={18}/></button>
              <button aria-label="Next" onClick={()=>calendarView==="MONTH"?calendarMonthBy(1):jumpDay(shiftDate(selectedDay,7))}><ChevronRight size={18}/></button>
              <div className="ops-segment"><button className={calendarView==="MONTH"?"active":""} onClick={()=>setCalendarView("MONTH")}>Month</button><button className={calendarView==="WEEK"?"active":""} onClick={()=>setCalendarView("WEEK")}>Week</button></div>
            </div></div>
          <div className="ops-calendar-month">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><span className="ops-weekday" key={d}>{d}</span>)}
            {visibleEvents.map(key=>{
              const evs=eventsOnDate(data.events,key);
              const tasks=tasksOnDate(data.tasks,key);
              return <button key={key} className={"ops-calendar-cell "+(key===today?"today ":"")+(key===selectedDay?"selected ":"")+(key.slice(0,7)!==focusMonth.slice(0,7)&&calendarView==="MONTH"?"outsider":"")} onClick={()=>jumpDay(key)}>
                <span className="ops-day-number">{dateParts(key).day}</span>
                <span className="ops-calendar-dots">{evs.slice(0,3).map(e=><i key={e.id} style={{background:e.color}} />)}{tasks.length>0&&<i className="ops-task-dot"/>}</span>
                <span className="ops-cal-count">{evs.length>0?evs.length+" events":tasks.length>0?tasks.length+" tasks":""}</span>
              </button>;
            })}
          </div>
          <div className="ops-calendar-key"><span><i className="ops-key-dot blue"/>Calendar events</span><span><i className="ops-key-dot amber"/>Responsibilities</span><span><i className="ops-key-dot outline"/>Selected day</span></div>
          <div className="ops-week-preview"><CardHead title="This week's upcoming moments" subtitle="A quick look beyond the selected day."/>
            {dayEventsInWeek.slice(0,5).map(e=><button className="ops-week-event" key={e.id} onClick={()=>openEvent(e)}><span>{dateLabel(eventDate(e))}</span><b>{e.title}</b><small>{clockDisplay(e.time)}</small><ChevronRight size={16}/></button>)}
            {!dayEventsInWeek.length&&<p className="ops-dim">No events recorded for this week.</p>}</div>
        </section>
        <aside className="ops-panel ops-calendar-agenda">
          <CardHead title={dateLabel(selectedDay,"long")} subtitle={weekDays[dayOfWeek(selectedDay)]+" · "+eventsToday.length+" events"}/>
          <div className="ops-agenda-list">{eventsToday.map(ev=><div className="ops-agenda-item" key={ev.id}>
            <span className="ops-agenda-time">{clockDisplay(ev.time)}</span><span className="ops-agenda-bar" style={{background:ev.color}}/>
            <div><strong>{ev.title}</strong><small>{ev.note||categoryLabels[ev.category||"FAMILY"]}</small>
              {ev.location&&<small><MapPin size={12}/>{ev.location}</small>}
              <MemberDots ids={ev.attendees} members={members}/></div>
            <button title={"Edit "+ev.title} aria-label={"Edit "+ev.title} onClick={()=>openEvent(ev)}><Edit3 size={15}/></button>
            <button title={"Cancel "+ev.title} aria-label={"Cancel "+ev.title} onClick={()=>cancelEvent(ev)}><Trash2 size={15}/></button>
          </div>)}
          {!eventsToday.length&&<Empty title="Nothing scheduled yet" copy="Leave room for rest, or add an event."/>}</div>
          <div className="ops-agenda-responsibilities"><CardHead title="Responsibilities" subtitle="Tasks due or repeating on this date."/>
            {todayTasks.slice(0,5).map(t=><button className="ops-agenda-task" key={t.id} onClick={()=>markTask(t)}><span className={"ops-check "+(taskDoneOn(t,selectedDay)?"done":"")}>{taskDoneOn(t,selectedDay)&&<Check size={14}/>}</span><span>{t.title}</span></button>)}
            {!todayTasks.length&&<p className="ops-dim">No responsibilities for this day.</p>}
          </div>
          <button className="ops-btn primary full" onClick={()=>openCreate("Event")}><Plus size={16}/> Add to this day</button>
        </aside>
      </div>
    </>}

    {route==="Responsibilities"&&<>
      <SectionHead kicker="FAMILY RESPONSIBILITIES" title="Share the work. Enjoy the moments." description="Clear ownership and simple completion, without competing scores."
        action={<button className="ops-btn primary" onClick={()=>openCreate("Task")}><Plus size={17}/> Add responsibility</button>}/>
      <div className="ops-filter-panel">
        <label className="ops-inline-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search responsibilities" placeholder="Search responsibilities"/></label>
        <label>Assigned to<select value={personFilter} onChange={e=>setPersonFilter(e.target.value)}><option value="ALL">All members</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Household<select value={houseFilter} onChange={e=>setHouseFilter(e.target.value)}><option value="ALL">All households</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
        <label>Date <input type="date" value={selectedDay} onChange={e=>e.target.value&&jumpDay(e.target.value)}/></label>
      </div>
      <div className="ops-filter-pills">{(["OPEN","DONE","ALL","ARCHIVED"] as const).map(p=>
        <button className={taskFilter===p?"active":""} key={p} onClick={()=>setTaskFilter(p)}>{p==="OPEN"?"Open":p==="DONE"?"Completed":p==="ARCHIVED"?"Archived":"All"}</button>)}
        <span>{taskScope.length} {taskScope.length===1?"responsibility":"responsibilities"} in view</span></div>
      <div className="ops-task-board">{Object.entries(groupedTasks).filter(([name])=>{
        if(taskFilter==="OPEN")return name==="Needs attention"||name==="To do";
        if(taskFilter==="DONE")return name==="Completed";
        if(taskFilter==="ARCHIVED")return name==="Archived";
        return name!=="Archived";
      }).map(([name,tasks])=><section key={name} className="ops-task-column"><div className="ops-column-head"><strong>{name}</strong><span>{tasks.length}</span></div>
        {tasks.map(t=><div className="ops-task-card" key={t.id}>
          <div className="ops-task-card-top"><span className={tagClass(categoryTones[t.category||"HOME"])}>{categoryLabels[t.category||"HOME"]}</span>
            <span className={tagClass(t.priority==="HIGH"?"rose":t.priority==="LOW"?"mint":"slate")}>{t.priority||"MEDIUM"} priority</span></div>
          <h3>{t.title}</h3>{t.description&&<p>{t.description}</p>}
          <div className="ops-task-meta"><Clock3 size={14}/><span>{dateLabel(taskAnchor(t))}</span>
            {t.repeat&&t.repeat!=="NONE"&&<><Repeat2 size={14}/><span>{repeatLabels[t.repeat]}</span></>}</div>
          <div className="ops-task-card-footer"><div><MemberDots ids={t.assigneeIds||[]} members={members}/><span>{memberLabels(data.members,t.assigneeIds||[])}</span></div>
            <div><button aria-label={"Edit "+t.title} onClick={()=>openTask(t)}><Edit3 size={16}/></button><button aria-label={t.archived?"Restore "+t.title:"Archive "+t.title} onClick={()=>archiveTask(t)}><Trash2 size={16}/></button></div></div>
          {!t.archived&&<button className={"ops-task-complete "+(taskDoneOn(t,selectedDay)?"finished":"")}
            disabled={Boolean(t.repeat&&t.repeat!=="NONE"&&!repeatsOn(t.repeat,taskAnchor(t),selectedDay))}
            onClick={()=>markTask(t,t.repeat&&t.repeat!=="NONE"?selectedDay:taskAnchor(t))}>
            {t.repeat&&t.repeat!=="NONE"&&!repeatsOn(t.repeat,taskAnchor(t),selectedDay)
              ?"Not scheduled for "+dateLabel(selectedDay)
              :taskDoneOn(t,selectedDay)?<><CheckCheck size={16}/> Completed · Undo</>
              :<><Circle size={16}/> {t.repeat&&t.repeat!=="NONE"?"Mark complete for "+dateLabel(selectedDay):"Mark complete"}</>}</button>}
        </div>)}
        {!tasks.length&&<p className="ops-column-empty">Nothing here. Nice and clear.</p>}
      </section>)}</div>
      <div className="ops-integration-note"><Info size={18}/> Recurring responsibilities are completed per date. Older preview tasks without a date behave as one-time tasks anchored to the current day.</div>
    </>}

    {route==="Routines"&&<>
      <SectionHead kicker="FAMILY ROUTINES" title="Routines that make room for life." description="Build consistent, supportive rhythms — not rigid rules."
        action={<button className="ops-btn primary" onClick={()=>openCreate("Routine")}><Plus size={17}/> Create routine</button>}/>
      <div className="ops-routine-bar"><div className="ops-date-nav"><button aria-label="Previous routine day" onClick={()=>jumpDay(shiftDate(selectedDay,-1))}><ChevronLeft size={17}/></button>
        <label><CalendarDays size={16}/><input type="date" aria-label="Routine date" value={selectedDay} onChange={e=>e.target.value&&jumpDay(e.target.value)}/></label>
        <button aria-label="Next routine day" onClick={()=>jumpDay(shiftDate(selectedDay,1))}><ChevronRight size={17}/></button></div>
        <span>{todayRoutines.filter(r=>completedRoutine(r,selectedDay)).length} of {todayRoutines.length} routines complete</span>
        <label className="ops-checkbox"><input type="checkbox" checked={showArchivedRoutines} onChange={e=>setShowArchivedRoutines(e.target.checked)}/> Show paused</label></div>
      <div className="ops-routines-grid">
        {data.operations.routines.filter(r=>r.active||showArchivedRoutines).map(r=>{
          const scheduled=scheduledRoutine(r,selectedDay);
          const stepsDone=(r.completedByDate[selectedDay]||[]).filter(id=>r.steps.some(s=>s.id===id)).length;
          const complete=completedRoutine(r,selectedDay);
          const skipped=r.skippedDates.includes(selectedDay);
          return <article key={r.id} className={"ops-routine-card "+(!r.active?"paused":"")}>
            <div className="ops-routine-card-top"><span className="ops-routine-icon"><Repeat2 size={23}/></span><div className="ops-routine-actions">
              <button title="Edit routine" aria-label={"Edit "+r.name} onClick={()=>openRoutine(r)}><Edit3 size={17}/></button>
              <button title={r.active?"Pause routine":"Resume routine"} aria-label={r.active?"Pause routine":"Resume routine"} onClick={()=>changeRoutineActive(r)}><Pause size={17}/></button>
            </div></div>
            <h3>{r.name}</h3><p>{r.description||"A shared family rhythm."}</p>
            <div className="ops-routine-tags"><span><Clock3 size={14}/>{clockDisplay(r.time)}</span><span><Repeat2 size={14}/>{repeatLabels[r.repeat]}</span>
              {r.repeat==="WEEKLY"&&<span>{weekDays[r.weekday]}</span>}</div>
            <div className="ops-routine-bar-progress"><div><span>Steps completed</span><b>{stepsDone} / {r.steps.length}</b></div><span className="ops-progress-track"><i style={{width:Math.round(stepsDone/Math.max(r.steps.length,1)*100)+"%"}}/></span></div>
            <div className="ops-routine-steps">{r.steps.map(s=><button key={s.id} disabled={!r.active||!scheduled||skipped}
              onClick={()=>toggleRun(r,s.id)}><span className={"ops-check "+((r.completedByDate[selectedDay]||[]).includes(s.id)?"done":"")}>{(r.completedByDate[selectedDay]||[]).includes(s.id)&&<Check size={15}/>}</span>
              <span>{s.text}</span></button>)}</div>
            <div className="ops-routine-footer"><MemberDots ids={r.memberIds} members={members}/>
              <span>{!r.active?"Paused":skipped?"Skipped for this date":!scheduled?"Not scheduled today":complete?"All steps complete":scheduled?"Ready to begin":""}</span></div>
            {scheduled&&r.active&&!skipped&&<button className={"ops-routine-finish "+(complete?"finished":"")} onClick={()=>toggleRun(r)}>
              {complete?<><CheckCheck size={17}/> Undo completion</>:<><Check size={17}/> Complete all steps</>}</button>}
            {scheduled&&r.active&&<button className="ops-skip-link" onClick={()=>{
              update(prev=>({...prev,operations:{...prev.operations,routines:prev.operations.routines.map(x=>x.id===r.id?
                {...x,skippedDates:x.skippedDates.includes(selectedDay)?x.skippedDates.filter(d=>d!==selectedDay):[...x.skippedDates,selectedDay]}:x)}}));
            }}>{skipped?"Restore this date":"Skip this date"}</button>}
          </article>;
        })}
        <button className="ops-new-routine" onClick={()=>openCreate("Routine")}><span><Plus size={27}/></span><strong>Create your own routine</strong><small>A few simple steps can make your family's day calmer.</small></button>
      </div>
      <div className="ops-integration-note"><Info size={18}/> Routines do not create duplicate calendar events or background jobs. Each date's completion and skip state is saved locally.</div>
    </>}

    {modal&&<div className="ops-modal-backdrop" onClick={()=>setModal(null)}><section className="ops-modal" role="dialog" aria-modal="true"
      aria-label={(editingId?"Edit ":"Create ")+modal} onClick={e=>e.stopPropagation()}>
      <header className="ops-modal-head"><div><span>FAMILY OS · BROWSER PREVIEW</span><h2>{editingId?"Edit ":"Create "}{modal==="Task"?"responsibility":modal==="Event"?"family event":modal==="Routine"?"routine":"family note"}</h2></div><button onClick={()=>setModal(null)} aria-label="Close"><X size={20}/></button></header>
      {modal==="Task"&&<form onSubmit={saveTask}><div className="ops-form-grid">
        <Field name="Title"><input autoFocus required maxLength={130} value={taskDraft.title} onChange={e=>setTaskDraft(p=>({...p,title:e.target.value}))}/></Field>
        <Field name="Category"><select value={taskDraft.category} onChange={e=>setTaskDraft(p=>({...p,category:e.target.value as Category}))}>{categories.map(c=><option value={c} key={c}>{categoryLabels[c]}</option>)}</select></Field>
        <Field name="Due / first occurrence"><input type="date" required value={taskDraft.dueDate} onChange={e=>setTaskDraft(p=>({...p,dueDate:e.target.value}))}/></Field>
        <Field name="Priority"><select value={taskDraft.priority} onChange={e=>setTaskDraft(p=>({...p,priority:e.target.value as Priority}))}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></Field>
        <Field name="Repeat"><select value={taskDraft.repeat} onChange={e=>setTaskDraft(p=>({...p,repeat:e.target.value as Repeat}))}>{taskRepeats.map(c=><option key={c} value={c}>{repeatLabels[c]}</option>)}</select></Field>
        <Field name="Household"><select value={taskDraft.householdId} onChange={e=>setTaskDraft(p=>({...p,householdId:e.target.value}))}><option value="">Whole family</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
        <Field name="Description"><textarea rows={3} maxLength={360} value={taskDraft.description} onChange={e=>setTaskDraft(p=>({...p,description:e.target.value}))}/></Field>
      </div><label className="ops-form-label">Assigned family members</label><Participants value={taskDraft.assigneeIds} all={members} onChange={v=>setTaskDraft(p=>({...p,assigneeIds:v}))}/>
      {formError&&<p className="ops-error" role="alert">{formError}</p>}<FormFooter onCancel={()=>setModal(null)}/></form>}
      {modal==="Event"&&<form onSubmit={saveEvent}><div className="ops-form-grid">
        <Field name="Event title"><input autoFocus required maxLength={130} value={eventDraft.title} onChange={e=>setEventDraft(p=>({...p,title:e.target.value}))}/></Field>
        <Field name="Date"><input type="date" required value={eventDraft.date} onChange={e=>setEventDraft(p=>({...p,date:e.target.value}))}/></Field>
        <Field name="Start time"><input type="time" required value={eventDraft.time} onChange={e=>setEventDraft(p=>({...p,time:e.target.value}))}/></Field>
        <Field name="End time"><input type="time" required value={eventDraft.endTime} onChange={e=>setEventDraft(p=>({...p,endTime:e.target.value}))}/></Field>
        <Field name="Category"><select value={eventDraft.category} onChange={e=>setEventDraft(p=>({...p,category:e.target.value as Category}))}>{categories.map(c=><option key={c} value={c}>{categoryLabels[c]}</option>)}</select></Field>
        <Field name="Household"><select value={eventDraft.householdId} onChange={e=>setEventDraft(p=>({...p,householdId:e.target.value}))}><option value="">Whole family</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
        <Field name="Location (general)"><input maxLength={120} value={eventDraft.location} onChange={e=>setEventDraft(p=>({...p,location:e.target.value}))}/></Field>
        <Field name="Event notes"><textarea rows={2} maxLength={360} value={eventDraft.note} onChange={e=>setEventDraft(p=>({...p,note:e.target.value}))}/></Field>
      </div><label className="ops-form-label">Family attendees</label><Participants value={eventDraft.attendees} all={members} onChange={v=>setEventDraft(p=>({...p,attendees:v}))}/>
      {formError&&<p className="ops-error" role="alert">{formError}</p>}<FormFooter onCancel={()=>setModal(null)}/></form>}
      {modal==="Routine"&&<form onSubmit={saveRoutine}><div className="ops-form-grid">
        <Field name="Routine name"><input autoFocus required maxLength={100} value={routineDraft.name} onChange={e=>setRoutineDraft(p=>({...p,name:e.target.value}))}/></Field>
        <Field name="Time"><input type="time" required value={routineDraft.time} onChange={e=>setRoutineDraft(p=>({...p,time:e.target.value}))}/></Field>
        <Field name="Repeat"><select value={routineDraft.repeat} onChange={e=>setRoutineDraft(p=>({...p,repeat:e.target.value as RoutineDraft["repeat"]}))}><option value="DAILY">Every day</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKLY">Every week</option></select></Field>
        <Field name="First active date"><input type="date" value={routineDraft.startDate} onChange={e=>setRoutineDraft(p=>({...p,startDate:e.target.value}))}/></Field>
        {routineDraft.repeat==="WEEKLY"&&<Field name="Day of week"><select value={routineDraft.weekday} onChange={e=>setRoutineDraft(p=>({...p,weekday:+e.target.value}))}>{weekDays.map((day,index)=><option key={day} value={index}>{day}</option>)}</select></Field>}
        <Field name="Household"><select value={routineDraft.householdId} onChange={e=>setRoutineDraft(p=>({...p,householdId:e.target.value}))}><option value="">Whole family</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
        <Field name="Description"><textarea rows={2} maxLength={250} value={routineDraft.description} onChange={e=>setRoutineDraft(p=>({...p,description:e.target.value}))}/></Field>
        <Field name="Steps — one per line"><textarea rows={5} required maxLength={1000} value={routineDraft.stepsText} onChange={e=>setRoutineDraft(p=>({...p,stepsText:e.target.value}))} placeholder={"Prepare breakfast\nCheck tomorrow's schedule\nFamily check-in"}/></Field>
      </div><label className="ops-form-label">Routine participants</label><Participants value={routineDraft.memberIds} all={members} onChange={v=>setRoutineDraft(p=>({...p,memberIds:v}))}/>
      {formError&&<p className="ops-error" role="alert">{formError}</p>}<FormFooter onCancel={()=>setModal(null)}/></form>}
      {modal==="Note"&&<form onSubmit={saveNote}><div className="ops-form-grid">
        <Field name="Heading"><input autoFocus required maxLength={120} value={noteDraft.title} onChange={e=>setNoteDraft(p=>({...p,title:e.target.value}))}/></Field>
        <Field name="Household"><select value={noteDraft.householdId} onChange={e=>setNoteDraft(p=>({...p,householdId:e.target.value}))}><option value="">Whole family</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
        <Field name="Written by"><select value={noteDraft.ownerId} onChange={e=>setNoteDraft(p=>({...p,ownerId:e.target.value}))}>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field name="Family note"><textarea rows={5} required maxLength={800} value={noteDraft.body} onChange={e=>setNoteDraft(p=>({...p,body:e.target.value}))}/></Field>
      </div>{formError&&<p className="ops-error" role="alert">{formError}</p>}<FormFooter onCancel={()=>setModal(null)}/></form>}
      <div className="ops-modal-disclaimer"><ShieldCheck size={15}/> Prototype data is unencrypted browser storage, not a private family account.</div>
    </section></div>}
    <footer className="ops-footer"><span>Family OS · Phase 3 · Family Operations</span><span>Local-only interactive preview · No live calendar or notifications</span></footer>
  </main>;
}
function FormFooter({onCancel}:{onCancel:()=>void}) {
  return <div className="ops-modal-actions"><button type="button" className="ops-btn secondary" onClick={onCancel}>Cancel</button><button type="submit" className="ops-btn primary"><Check size={16}/> Save changes</button></div>;
}
