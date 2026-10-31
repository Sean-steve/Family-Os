import { describe, expect, it } from "vitest";
import type { Task, PlanEvent } from "../data";
import {
  dateKey, parseDate, shiftDate, dayOfWeek, startOfWeek, monthGrid, parseClock,
  repeatsOn, taskAnchor, tasksOnDate, taskDoneOn, toggleTaskForDate,
  scheduledRoutine, completedRoutine, toggleRoutineStep, toggleRoutineDay,
  eventsOnDate, eventsBetween, findEventConflicts, normalizeOperations,
  seedOperations, taskLoadByMember, overdueTasks
} from "./model";
const base="2026-10-31";
const task=(rest:Partial<Task>={}):Task=>({id:"t1",title:"Water plants",person:"Alex",due:"Today",done:false,...rest});
const event=(rest:Partial<PlanEvent>={}):PlanEvent=>({id:"e1",time:"13:00",title:"Meeting",
  note:"",attendees:["alex"],color:"#82b3f2",date:base,...rest});
describe("operations date and calendar",()=>{
  it("generates ISO calendar days, including month and year boundaries",()=>{
    expect(shiftDate("2026-12-31",1)).toBe("2027-01-01");
    expect(shiftDate("2027-03-01",-1)).toBe("2027-02-28");
    expect(startOfWeek("2026-10-31")).toBe("2026-10-26");
    expect(monthGrid("2026-10-31")).toHaveLength(42);
    expect(monthGrid("2026-10-31")[0]).toBe("2026-09-28");
    expect(dayOfWeek("2026-10-31")).toBe(6);
    expect(dateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(()=>parseDate("2026-02-30")).toThrow();
  });
  it("sorts events chronologically regardless of 12h or 24h clock",()=>{
    const events=[event(),event({id:"morning",time:"7:30 AM",title:"Breakfast"}),
      event({id:"late",time:"3:30 PM",title:"School pickup"})];
    expect(eventsOnDate(events,base).map(x=>x.id)).toEqual(["morning","e1","late"]);
    expect(parseClock("12:00 AM")).toBe(0);
    expect(parseClock("12:00 PM")).toBe(720);
    expect(parseClock("23:45")).toBe(1425);
  });
  it("filters and excludes cancelled events",()=>{
    const events=[event(),event({id:"tomorrow",date:"2026-11-01"}),
      event({id:"cancelled",status:"CANCELLED"})];
    expect(eventsOnDate(events,base)).toHaveLength(1);
    expect(eventsBetween(events,base,"2026-11-02")).toHaveLength(2);
  });
  it("detects overlaps only when people, times and dates match",()=>{
    const events=[
      event({id:"a",time:"14:00",endTime:"15:00",attendees:["alex"]}),
      event({id:"b",time:"14:30",endTime:"15:30",attendees:["alex","jamie"]}),
      event({id:"c",time:"14:30",endTime:"15:30",attendees:["sam"]}),
      event({id:"d",time:"14:30",endTime:"15:30",attendees:["alex"],date:"2026-11-01"})
    ];
    expect(findEventConflicts(events,base,base)).toEqual([{a:"a",b:"b",date:base,attendeeIds:["alex"]}]);
  });
});
describe("recurring responsibilities",()=>{
  it("respects occurrence anchors and repeat rules",()=>{
    expect(repeatsOn("NONE",base,base)).toBe(true);
    expect(repeatsOn("NONE",base,"2026-11-01")).toBe(false);
    expect(repeatsOn("DAILY",base,"2026-11-01")).toBe(true);
    expect(repeatsOn("WEEKDAYS",base,"2026-10-31")).toBe(false);
    expect(repeatsOn("WEEKDAYS",base,"2026-11-02")).toBe(true);
    expect(repeatsOn("WEEKLY",base,"2026-11-07")).toBe(true);
    expect(repeatsOn("WEEKLY",base,"2026-11-08")).toBe(false);
  });
  it("maps legacy Today/Tomorrow due strings without deleting them",()=>{
    expect(taskAnchor(task(),base)).toBe(base);
    expect(taskAnchor(task({due:"Tomorrow"}),base)).toBe("2026-11-01");
    expect(tasksOnDate([task(),task({id:"next",due:"Tomorrow"})],base,base).map(t=>t.id)).toEqual(["t1"]);
  });
  it("tracks recurring completions per date instead of completing the entire template",()=>{
    const recurring=task({repeat:"DAILY",dueDate:base});
    const done=toggleTaskForDate(recurring,base);
    expect(taskDoneOn(done,base)).toBe(true);
    expect(taskDoneOn(done,"2026-11-01")).toBe(false);
    expect(taskDoneOn(toggleTaskForDate(done,base),base)).toBe(false);
    expect(taskDoneOn(recurring,base)).toBe(false);
  });
  it("keeps one-time completion backward compatible and tracks overdue tasks",()=>{
    const once=toggleTaskForDate(task(),base);
    expect(once.done).toBe(true);
    expect(overdueTasks([task({dueDate:"2026-10-30"}),once],base,base)).toHaveLength(1);
    expect(taskLoadByMember([task({assigneeIds:["alex","jamie"],dueDate:base})],
      ["alex","jamie"],base,base)).toEqual({alex:1,jamie:1});
  });
});
describe("recurring routines and local state migration",()=>{
  it("keeps existing data when upgrading and adds defaults for older previews",()=>{
    const copy=normalizeOperations(null);
    copy.routines[0].name="Changed";
    expect(normalizeOperations(null).routines[0].name).toBe(seedOperations.routines[0].name);
    const existing=normalizeOperations({routines:[],notes:[]});
    expect(existing.routines).toHaveLength(0);
    expect(existing.notes).toHaveLength(0);
  });
  it("schedules weekly routines on the configured weekday only",()=>{
    const routine=seedOperations.routines[2];
    expect(scheduledRoutine(routine,"2026-10-31")).toBe(true);
    expect(scheduledRoutine(routine,"2026-11-01")).toBe(false);
  });
  it("tracks each step and can complete/undo an occurrence",()=>{
    const r=seedOperations.routines[0];
    const after=toggleRoutineStep(r,"2026-11-02","am-1");
    expect(after.completedByDate["2026-11-02"]).toEqual(["am-1"]);
    expect(completedRoutine(after,"2026-11-02")).toBe(false);
    const full=toggleRoutineDay(after,"2026-11-02");
    expect(completedRoutine(full,"2026-11-02")).toBe(true);
    expect(completedRoutine(toggleRoutineDay(full,"2026-11-02"),"2026-11-02")).toBe(false);
    expect(r.completedByDate).toEqual({});
  });
});
