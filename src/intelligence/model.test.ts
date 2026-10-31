import {describe,expect,it} from "vitest";
import {seed} from "../data";
import {
  chiefOfStaffReply,createBriefing,deriveSignals,dismissSignal,evidenceCoverage,
  INTELLIGENCE_VERSION,isDismissed,migrateIntelligence,restoreSignal,saveBriefing
} from "./model";
import type {AppData} from "../data";
const day="2026-10-31";
const sample=():AppData=>structuredClone(seed);
const clean=():AppData=>{
  const d=sample();d.tasks=[];d.goals=[];d.events=[];d.governance.decisions=[];
  d.life.experiences=[];d.life.traditions=[];return d;
};
describe("Phase 7 explainable intelligence",()=>{
  it("produces no invented risks from an empty family browser",()=>{
    const d=clean();
    expect(deriveSignals(d,day)).toEqual([]);
    const b=createBriefing(d,day);
    expect(b.attention).toHaveLength(0);
    expect(b.opportunities).toHaveLength(0);
    expect(b.summary).toMatch(/does not mean everything is okay/i);
    expect(b.ruleVersion).toBe(INTELLIGENCE_VERSION);
  });
  it("records only dated, non-sensitive, uncompleted one-off tasks as overdue",()=>{
    const d=clean();
    d.tasks=[
      {id:"home-1",title:"Clean family home",person:"Alex",due:"Today",done:false,dueDate:"2026-10-30",category:"HOME"},
      {id:"medical",title:"Private medical appointment",person:"Alex",due:"Today",done:false,dueDate:"2026-10-30",category:"HEALTH"},
      {id:"legacy",title:"Private unspecified task",person:"Alex",due:"Today",done:false,dueDate:"2026-10-30"},
      {id:"done",title:"Completed household task",person:"Alex",due:"Today",done:true,dueDate:"2026-10-30",category:"HOME"},
      {id:"repeat",title:"Recurring home task",person:"Alex",due:"Today",done:false,dueDate:"2026-10-30",category:"HOME",repeat:"DAILY"}
    ];
    const signals=deriveSignals(d,day);
    const overdue=signals.find(s=>s.id==="ops-overdue");
    expect(overdue?.title).toMatch(/^1 overdue/);
    expect(overdue?.evidence.map(e=>e.entityId)).toEqual(["home-1"]);
    expect(JSON.stringify(signals)).not.toContain("Private medical appointment");
    expect(JSON.stringify(signals)).not.toContain("Private unspecified task");
    expect(overdue?.rule).toContain("due date");
    expect(overdue?.limitation).toMatch(/excluded/i);
  });
  it("flags explicitly unassigned shared tasks but not legacy missing assignment arrays",()=>{
    const d=clean();d.tasks=[
      {id:"unassigned",title:"Shared grocery pickup",person:"",due:"Today",done:false,dueDate:"2026-11-02",category:"HOME",assigneeIds:[]},
      {id:"legacy",title:"Existing text assignment",person:"Alex",due:"Today",done:false,dueDate:"2026-11-02",category:"HOME"},
      {id:"assigned",title:"Assigned",person:"Alex",due:"Today",done:false,dueDate:"2026-11-02",category:"HOME",assigneeIds:["alex"]}
    ];
    expect(deriveSignals(d,day).find(s=>s.id==="ops-unassigned")?.evidence.map(x=>x.entityId)).toEqual(["unassigned"]);
  });
  it("requires explicit shared labels before detecting family event overlap",()=>{
    const d=clean();
    const event=(id:string,category:"FAMILY"|"HEALTH",time:string)=>({
      id,title:"Meeting "+id,time,note:"",attendees:["alex"],color:"#aaccff",
      date:day,endTime:"15:00",category,status:"ACTIVE" as const
    });
    d.events=[event("one","FAMILY","13:00"),event("two","FAMILY","14:00"),event("medical","HEALTH","14:00")];
    const s=deriveSignals(d,day).find(x=>x.id==="calendar-overlap");
    expect(s?.evidence.map(x=>x.entityId).sort()).toEqual(["one","two"]);
    expect(JSON.stringify(s)).not.toContain("medical");
  });
  it("distinguishes passed goal targets from upcoming targets without predicting success",()=>{
    const d=clean();
    d.goals=[
      {id:"g-overdue",title:"Community garden goal",meta:"Family",image:"",color:"green",progress:20,targetDate:"2026-10-30",status:"ACTIVE"},
      {id:"g-coming",title:"Make a family album",meta:"Family",image:"",color:"green",progress:80,targetDate:"2026-11-08",status:"ACTIVE"},
      {id:"g-done",title:"Completed",meta:"Family",image:"",color:"blue",progress:100,targetDate:"2026-10-01",status:"COMPLETED"}
    ];
    const signals=deriveSignals(d,day);
    expect(signals.find(s=>s.id==="goals-past-target")?.evidence.map(x=>x.entityId)).toEqual(["g-overdue"]);
    expect(signals.find(s=>s.id==="goals-upcoming")?.evidence.map(x=>x.entityId)).toEqual(["g-coming"]);
    expect(JSON.stringify(signals)).toMatch(/self-reported/i);
    expect(JSON.stringify(signals)).not.toMatch(/83% probability|success rate/i);
  });
  it("connects existing governance, experiences and traditions without creating new actions",()=>{
    const d=sample();
    const signals=deriveSignals(d,day);
    expect(signals.some(s=>s.id==="decisions-awaiting")).toBe(true);
    expect(signals.some(s=>s.id==="experiences-not-on-calendar")).toBe(true);
    expect(signals.some(s=>s.id==="traditions-coming")).toBe(true);
    expect(d.events).toHaveLength(seed.events.length);
    expect(d.governance.decisions[0].status).toBe("OPEN");
  });
  it("gives explicit evidence source, date, rule, limitation and owning workspace for each signal",()=>{
    for(const s of deriveSignals(sample(),day)){
      expect(s.fingerprint.length).toBeGreaterThan(3);
      expect(s.asOf).toBe(day);
      expect(s.evidence.length).toBeGreaterThan(0);
      expect(s.rule.length).toBeGreaterThan(10);
      expect(s.limitation.length).toBeGreaterThan(15);
      expect(s.destination.length).toBeGreaterThan(3);
      for(const ref of s.evidence){
        expect(ref.entityId).toBeTruthy();
        expect(ref.destination).toBeTruthy();
      }
    }
  });
  it("re-surfaces a dismissed signal when its evidence changes",()=>{
    const d=sample();const s=deriveSignals(d,day).find(x=>x.id==="decisions-awaiting")!;
    const empty=migrateIntelligence(undefined);
    const dismissed=dismissSignal(empty,s,"2026-10-31T10:00:00Z");
    expect(isDismissed(s,dismissed)).toBe(true);
    expect(isDismissed(s,restoreSignal(dismissed,s.id))).toBe(false);
    d.governance.decisions[0].status="RESOLVED";
    const updated=deriveSignals(d,day).find(x=>x.id==="decisions-awaiting")!;
    expect(updated.fingerprint).not.toBe(s.fingerprint);
    expect(isDismissed(updated,dismissed)).toBe(false);
    expect(empty.dismissals).toEqual([]);
  });
  it("preserves intentionally empty saved state, snapshots evidence without approval",()=>{
    expect(migrateIntelligence({savedBriefs:[],dismissals:[]})).toEqual({savedBriefs:[],dismissals:[]});
    const d=sample();const b=createBriefing(d,day);
    const saved=saveBriefing(migrateIntelligence(undefined),b,"2026-10-31T12:30:00Z","Discuss our plans");
    expect(saved.savedBriefs).toHaveLength(1);
    expect(saved.savedBriefs[0].note).toBe("Discuss our plans");
    expect(saved.savedBriefs[0].ruleVersion).toBe(INTELLIGENCE_VERSION);
    expect(saved.savedBriefs[0].signals.length).toBeGreaterThan(0);
    expect(saved.dismissals).toEqual([]);
    expect(d.governance.decisions[0].status).toBe("OPEN");
  });
  it("separates unknown Health, Finance and Kernel data from family records",()=>{
    const d=sample(),coverage=evidenceCoverage(d);
    expect(coverage.find(c=>c.area==="Finance OS")?.status).toBe("NOT_CONNECTED");
    expect(coverage.find(c=>c.area==="Health / Nutrition OS")?.status).toBe("NOT_CONNECTED");
    expect(coverage.find(c=>c.area==="Personal Kernel / HumanKernelOS")?.status).toBe("NOT_CONNECTED");
    const answer=chiefOfStaffReply(d,"gaps",day);
    expect(answer.body).toMatch(/No personal health/i);
    expect(answer.signals).toEqual([]);
    const attention=chiefOfStaffReply(clean(),"attention",day);
    expect(attention.body).toMatch(/No matching signals/i);
    expect(attention.disclaimer).toMatch(/No AI model/i);
  });
});
