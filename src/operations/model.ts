/**
 * Phase 3: local-only family operations contract and date-only domain helpers.
 * No calendar provider, backend, scheduler, notifications, identity or access control.
 */
import type { PlanEvent, Task } from "../data";
export type Repeat = "NONE" | "DAILY" | "WEEKDAYS" | "WEEKLY";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type Category = "HOME" | "SCHOOL" | "HEALTH" | "FAMILY" | "WORK" | "OTHER";
export type RoutineStep = { id: string; text: string };
export type Routine = {
  id: string; name: string; description: string; time: string; repeat: Exclude<Repeat, "NONE">;
  weekday: number; householdId: string; memberIds: string[]; steps: RoutineStep[];
  startDate: string; active: boolean; completedByDate: Record<string,string[]>;
  skippedDates: string[];
};
export type FamilyNote = {
  id: string; title: string; body: string; ownerId: string;
  householdId: string; pinned: boolean; createdAt: string; archived: boolean;
};
export type OperationsState = { routines: Routine[]; notes: FamilyNote[] };
export const priorityLabels: Record<Priority,string> = { LOW:"Low",MEDIUM:"Medium",HIGH:"High" };
export const categoryLabels: Record<Category,string> = {
  HOME:"Home",SCHOOL:"School",HEALTH:"Health",FAMILY:"Family",WORK:"Work",OTHER:"Other"
};
export const repeatLabels: Record<Repeat,string> = {
  NONE:"Does not repeat",DAILY:"Every day",WEEKDAYS:"Weekdays",WEEKLY:"Every week"
};
export const weekDays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export function dateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB",{
    timeZone:"Africa/Nairobi", year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  const get = (type:string) => parts.find(p => p.type === type)?.value || "";
  return get("year")+"-"+get("month")+"-"+get("day");
}
export function parseDate(key:string): Date {
  const match = /^(\d{4})-(\d\d)-(\d\d)$/.exec(key);
  if (!match) throw new Error("Date must be YYYY-MM-DD");
  const d = new Date(Date.UTC(+match[1],+match[2]-1,+match[3]));
  if (d.toISOString().slice(0,10) !== key) throw new Error("Invalid calendar date");
  return d;
}
export function shiftDate(key:string, days:number):string {
  const d=parseDate(key); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10);
}
export function dayOfWeek(key:string):number { return parseDate(key).getUTCDay(); }
export function startOfWeek(key:string):string { return shiftDate(key,-((dayOfWeek(key)+6)%7)); } // Monday
export function monthGrid(key:string):string[] {
  const {year,month}=dateParts(key);
  const first=year+"-"+String(month).padStart(2,"0")+"-01";
  const start=startOfWeek(first);
  return Array.from({length:42},(_,i)=>shiftDate(start,i));
}
export function dateParts(key:string):{year:string;month:number;day:number} {
  const date=parseDate(key); return {year:String(date.getUTCFullYear()),month:date.getUTCMonth()+1,day:date.getUTCDate()};
}
export function eventDate(event:PlanEvent,base=dateKey()):string { return event.date || base; }
export function dateLabel(key:string,style:"short"|"long"="short"):string {
  return new Intl.DateTimeFormat("en-GB",{month:style==="short"?"short":"long",day:"numeric",year:style==="long"?"numeric":undefined,timeZone:"UTC"}).format(parseDate(key));
}
export function parseClock(time:string):number {
  const clock=time.trim().match(/^(\d{1,2}):(\d\d)\s*(AM|PM)?$/i);
  if(!clock) return 12*60;
  let h=+clock[1];const m=+clock[2]; if(h>23 || m>59 || (clock[3] && (h<1 || h>12)))return 12*60;
  if(clock[3]) h=(h%12)+(clock[3].toUpperCase()==="PM"?12:0);
  return h*60+m;
}
export function clockDisplay(time:string):string {
  const min=parseClock(time), h=Math.floor(min/60), m=min%60;
  return (h%12||12)+":"+String(m).padStart(2,"0")+(h>=12?" PM":" AM");
}
export function eventsOnDate(events:PlanEvent[],day:string,base=dateKey()):PlanEvent[] {
  return events.filter(e=>e.status!=="CANCELLED"&&eventDate(e,base)===day)
    .sort((a,b)=>parseClock(a.time)-parseClock(b.time)||a.title.localeCompare(b.title));
}
export function eventsBetween(events:PlanEvent[],start:string,end:string,base=dateKey()):PlanEvent[] {
  return events.filter(e=>e.status!=="CANCELLED"&&eventDate(e,base)>=start&&eventDate(e,base)<=end)
    .sort((a,b)=>eventDate(a,base).localeCompare(eventDate(b,base))||parseClock(a.time)-parseClock(b.time));
}
export function taskAnchor(task:Task,base=dateKey()):string {
  if(task.dueDate)return task.dueDate;
  return task.due==="Tomorrow"?shiftDate(base,1):base;
}
export function repeatsOn(repeat:Repeat,start:string,target:string):boolean {
  if(target<start)return false;
  if(repeat==="NONE")return target===start;
  if(repeat==="DAILY")return true;
  if(repeat==="WEEKDAYS")return dayOfWeek(target)>=1&&dayOfWeek(target)<=5;
  const diff=Math.round((parseDate(target).getTime()-parseDate(start).getTime())/86400000);
  return diff%7===0;
}
export function tasksOnDate(tasks:Task[],target:string,base=dateKey()):Task[] {
  return tasks.filter(t=>!t.archived&&repeatsOn(t.repeat||"NONE",taskAnchor(t,base),target));
}
export function taskDoneOn(task:Task,target:string):boolean {
  return task.repeat&&task.repeat!=="NONE"?(task.completedDates||[]).includes(target):!!task.done;
}
export function toggleTaskForDate(task:Task,target:string):Task {
  if(!task.repeat||task.repeat==="NONE")return {...task,done:!task.done};
  const dates=new Set(task.completedDates||[]);
  if(dates.has(target))dates.delete(target);else dates.add(target);
  return {...task,completedDates:[...dates].sort()};
}
export function overdueTasks(tasks:Task[],target=dateKey(),base=dateKey()):Task[] {
  return tasks.filter(t=>!t.archived&&taskAnchor(t,base)<target&&(!t.repeat||t.repeat==="NONE")&&!t.done);
}
export function taskLoadByMember(tasks:Task[],members:string[],day:string,base=dateKey()):Record<string,number> {
  const counts:Record<string,number>=Object.fromEntries(members.map(id=>[id,0]));
  tasksOnDate(tasks,day,base).filter(t=>!taskDoneOn(t,day)).forEach(t=>{
    (t.assigneeIds||[]).forEach(id=>{if(id in counts) counts[id]++;});
  });
  return counts;
}
export function scheduledRoutine(r:Routine,target:string):boolean {
  if(!r.active||target<r.startDate)return false;
  if(r.repeat==="DAILY")return true;
  if(r.repeat==="WEEKDAYS")return dayOfWeek(target)>=1&&dayOfWeek(target)<=5;
  return dayOfWeek(target)===r.weekday;
}
export function routinesOnDate(routines:Routine[],target:string):Routine[] {
  return routines.filter(r=>scheduledRoutine(r,target)&&!r.skippedDates.includes(target))
    .sort((a,b)=>parseClock(a.time)-parseClock(b.time));
}
export function completedRoutine(r:Routine,target:string):boolean {
  return r.steps.length>0&&r.steps.every(step=>(r.completedByDate[target]||[]).includes(step.id));
}
export function toggleRoutineStep(r:Routine,target:string,stepId:string):Routine {
  if(!r.steps.some(s=>s.id===stepId))return r;
  const current=new Set(r.completedByDate[target]||[]);
  if(current.has(stepId))current.delete(stepId); else current.add(stepId);
  return {...r,completedByDate:{...r.completedByDate,[target]:[...current]}};
}
export function toggleRoutineDay(r:Routine,target:string):Routine {
  const complete=completedRoutine(r,target);
  return {...r,completedByDate:{...r.completedByDate,[target]:complete?[]:r.steps.map(s=>s.id)}};
}
export type EventCollision = { a: string; b: string; date: string; attendeeIds: string[] };
export function findEventConflicts(events:PlanEvent[],start:string,end:string,base=dateKey()):EventCollision[] {
  const relevant=eventsBetween(events,start,end,base);
  const found:EventCollision[]=[];
  for(let i=0;i<relevant.length;i++)for(let j=i+1;j<relevant.length;j++){
    const a=relevant[i],b=relevant[j],day=eventDate(a,base);
    if(day!==eventDate(b,base))continue;
    const shared=a.attendees.filter(id=>b.attendees.includes(id));
    if(!shared.length)continue;
    const aStart=parseClock(a.time),bStart=parseClock(b.time);
    const aEnd=a.endTime?parseClock(a.endTime):aStart+60;
    const bEnd=b.endTime?parseClock(b.endTime):bStart+60;
    if(aStart<bEnd&&bStart<aEnd)found.push({a:a.id,b:b.id,date:day,attendeeIds:shared});
  }
  return found;
}
export const seedOperations:OperationsState={
  routines:[
    {id:"routine-am",name:"School morning rhythm",description:"A calmer start for the school day.",
     time:"07:00",repeat:"WEEKDAYS",weekday:1,householdId:"household-home",
     memberIds:["alex","jamie","sam","ella","noah"],steps:[
       {id:"am-1",text:"Breakfast and water"},
       {id:"am-2",text:"School bags and essentials"},
       {id:"am-3",text:"Leave home ready"}],
     startDate:"2020-01-01",active:true,completedByDate:{},skippedDates:[]},
    {id:"routine-pm",name:"Evening family reset",description:"Tidy, connect and prepare tomorrow.",
     time:"19:30",repeat:"DAILY",weekday:1,householdId:"household-home",
     memberIds:["alex","jamie","sam","ella","noah"],steps:[
       {id:"pm-1",text:"Quick home tidy"},{id:"pm-2",text:"Check tomorrow's plans"},
       {id:"pm-3",text:"Family check-in"}],
     startDate:"2020-01-01",active:true,completedByDate:{},skippedDates:[]},
    {id:"routine-weekend",name:"Saturday home care",description:"Share the work and enjoy the weekend.",
     time:"09:00",repeat:"WEEKLY",weekday:6,householdId:"household-home",
     memberIds:["alex","jamie","sam"],steps:[
       {id:"wk-1",text:"Plan supplies"},{id:"wk-2",text:"Shared cleaning"},
       {id:"wk-3",text:"Celebrate a job well done"}],
     startDate:"2020-01-01",active:true,completedByDate:{},skippedDates:[]}
  ],
  notes:[
    {id:"note-week",title:"A little planning goes a long way",
     body:"Review next week's commitments together and share the load.",
     ownerId:"alex",householdId:"household-home",pinned:true,createdAt:"2026-10-01",archived:false},
    {id:"note-weekend",title:"Weekend ideas",
     body:"Check the weather, choose an activity and make time to relax.",
     ownerId:"jamie",householdId:"household-home",pinned:false,createdAt:"2026-10-02",archived:false}
  ]
};
export function normalizeOperations(value:unknown):OperationsState {
  if(!value||typeof value!=="object")return structuredClone(seedOperations);
  const obj=value as Partial<OperationsState>;
  return {routines:Array.isArray(obj.routines)?obj.routines:structuredClone(seedOperations.routines),
    notes:Array.isArray(obj.notes)?obj.notes:structuredClone(seedOperations.notes)};
}
