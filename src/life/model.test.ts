import {describe,expect,it} from "vitest";
import {
  experienceAsCalendarEvent,legacyFromMemory,lifeStats,memoryFromExperience,memoryFromTradition,
  nextTraditionDate,normalizeLife,recordTraditionMoment,seedLife,sortMemories,
  validateExperience,validateLegacy,validateMemory,validateTradition,validDate
} from "./model";
import type {Memory,Tradition} from "./model";
const people=["alex","jamie","sam","ella","noah"];
const goals=["g1","g2","g3"];
describe("Phase 6 family life persistence",()=>{
  it("migrates missing Phases 1–5 preview life state with independent copy",()=>{
    const first=normalizeLife(null);first.experiences[0].title="Changed";
    expect(normalizeLife(undefined).experiences[0].title).toBe("Riverside family picnic");
    const saved={experiences:[],memories:[],traditions:[],legacy:[]};
    expect(normalizeLife(saved)).toEqual(saved); // User's intentionally empty state is preserved
  });
  it("calculates actual collection counts without invented wellbeing scores",()=>{
    expect(lifeStats(seedLife)).toEqual({
      plannedExperiences:2,recordedMemories:2,activeTraditions:2,preservedLegacy:1
    });
  });
  it("validates calendar dates and personal relationships",()=>{
    expect(validDate("2026-02-28")).toBe(true);
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
    const exp=structuredClone(seedLife.experiences[0]);
    expect(validateExperience(exp,people,goals)).toBeNull();
    expect(validateExperience({...exp,memberIds:["unknown"]},people,goals)).toMatch(/active/i);
    expect(validateExperience({...exp,linkedGoalId:"unknown"},people,goals)).toMatch(/strategy goal/i);
    expect(validateExperience({...exp,date:"2026-02-30"},people,goals)).toMatch(/date/i);
  });
  it("creates one usable canonical calendar event from an experience and keeps original immutable",()=>{
    const e=seedLife.experiences[1];
    const added=experienceAsCalendarEvent(e);
    expect(added.date).toBe(e.date);
    expect(added.attendees).toEqual(e.memberIds);
    expect(added.id).toMatch(/^event-life-/);
    expect(e.linkedEventId).toBe("");
    expect(added.title).toBe(e.title);
    expect(()=>experienceAsCalendarEvent({...e,date:""})).toThrow(/valid date/i);
    expect(experienceAsCalendarEvent({...e,time:"23:30"}).endTime).toBe("23:59");
    expect(()=>experienceAsCalendarEvent({...e,time:"23:59"})).toThrow(/earlier than 23:59/i);
  });
});
describe("Family memory & responsible preview notes",()=>{
  it("creates a draft from an experience without publishing or sharing",()=>{
    const exp=seedLife.experiences[0];
    const memory=memoryFromExperience(exp,"2026-10-31");
    expect(memory.status).toBe("DRAFT");
    expect(memory.consent).toBe("NOT_RECORDED");
    expect(memory.visibility).toBe("REVIEW_FIRST");
    expect(memory.experienceId).toBe(exp.id);
    expect(memory.memberIds).toEqual(exp.memberIds);
    expect(memory.memberIds).not.toBe(exp.memberIds);
  });
  it("validates memory member, date, consent status and links",()=>{
    const mem=memoryFromExperience(seedLife.experiences[0],"2026-10-31");
    expect(validateMemory(mem,people,seedLife)).toBeNull();
    const recorded:Memory={...mem,status:"RECORDED"};
    expect(validateMemory(recorded,people,seedLife)).toMatch(/consent/i);
    expect(validateMemory({...recorded,consent:"REVIEW_NEEDED"},people,seedLife)).toBeNull();
    expect(validateMemory({...mem,experienceId:"unknown"},people,seedLife)).toMatch(/experience/i);
    expect(validateMemory({...mem,story:""},people,seedLife)).toMatch(/story/i);
  });
  it("sorts a timeline by date and excludes archived entries",()=>{
    const sample=seedLife.memories[0];
    const out=sortMemories([
      {...sample,id:"a",date:"2025-06-10",status:"RECORDED"},
      {...sample,id:"b",date:"2026-01-01",status:"DRAFT"},
      {...sample,id:"c",date:"2026-03-01",status:"ARCHIVED"}
    ]);
    expect(out.map(x=>x.id)).toEqual(["b","a"]);
  });
  it("connects memories to a legacy draft without copying data into other collections",()=>{
    const mem=seedLife.memories[0];
    const legacy=legacyFromMemory(mem,"2026-10-31");
    expect(legacy.kind).toBe("STORY");
    expect(legacy.linkedMemoryIds).toEqual([mem.id]);
    expect(legacy.status).toBe("DRAFT");
    expect(legacy.visibility).toBe("REVIEW_FIRST");
    expect(validateLegacy(legacy,people,seedLife)).toBeNull();
    expect(validateLegacy({...legacy,linkedMemoryIds:["missing"]},people,seedLife)).toMatch(/linked memory/i);
    expect(validateLegacy({...legacy,intendedRevealDate:"2026-13-40"},people,seedLife)).toMatch(/valid/i);
  });
});
describe("Traditions and recurrence",()=>{
  it("resolves the next weekly and annual tradition date",()=>{
    const weekly=seedLife.traditions[0];
    expect(nextTraditionDate(weekly,"2026-10-31")).toBe("2026-10-31");
    expect(nextTraditionDate(weekly,"2026-11-01")).toBe("2026-11-07");
    const yearly=seedLife.traditions[1];
    expect(nextTraditionDate(yearly,"2026-11-01")).toBe("2026-12-31");
    expect(nextTraditionDate({...yearly,active:false},"2026-11-01")).toBeNull();
    expect(nextTraditionDate({...yearly,cadence:"OCCASIONAL"},"2026-11-01")).toBeNull();
  });
  it("skips nonexisting monthly days and leap days until the next valid occurrence",()=>{
    const basis=seedLife.traditions[0];
    const monthly:Tradition={...basis,cadence:"MONTHLY",day:31};
    expect(nextTraditionDate(monthly,"2026-04-01")).toBe("2026-05-31");
    const leap:Tradition={...basis,cadence:"YEARLY",month:2,day:29};
    expect(nextTraditionDate(leap,"2026-01-01")).toBe("2028-02-29");
    expect(validateTradition(leap,people)).toBeNull();
    expect(validateTradition({...leap,month:4,day:31},people)).toMatch(/valid/i);
  });
  it("records a dated occurrence, preserves template and creates a linked memory draft",()=>{
    const template=seedLife.traditions[0];
    const next=recordTraditionMoment(template,"2026-10-31","Family fun", "");
    expect(next.moments).toHaveLength(template.moments.length+1);
    expect(template.moments.length).toBe(1);
    expect(next.moments[next.moments.length-1]?.date).toBe("2026-10-31");
    const mem=memoryFromTradition(template,"2026-10-31");
    expect(mem.traditionId).toBe(template.id);
    expect(mem.status).toBe("DRAFT");
    expect(()=>recordTraditionMoment(template,"2026-02-30","bad")).toThrow(/valid/i);
  });
});
