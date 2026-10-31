import {describe,expect,it} from "vitest";
import type {Goal} from "../data";
import {
  clampProgress,goalHistoryLabel,migrateStrategy,missionProgress,milestoneProgress,
  objectiveProgress,overallProgress,recordGoalProgress,normalizedGoals,relatedGoals,validParent
} from "./model";
const goals:Goal[]=[
  {id:"g1",title:"Trip",meta:"Family",image:"",color:"green",progress:75,objectiveId:"objective-trip",status:"ACTIVE",history:[]},
  {id:"g2",title:"Reserve",meta:"Safety",image:"",color:"blue",progress:40,objectiveId:"objective-reserve",status:"ACTIVE",history:[]},
  {id:"g3",title:"Health",meta:"Daily",image:"",color:"green",progress:60,objectiveId:"objective-habits",status:"ACTIVE",history:[]}
];
describe("Family strategy model",()=>{
  it("migrates old preview without overwriting actual family goal progress",()=>{
    const first=migrateStrategy(undefined);
    first.vision.statement="edited";
    expect(migrateStrategy(undefined).vision.statement).not.toBe("edited");
    const legacy=normalizedGoals(goals.map(g=>({id:g.id,title:g.title,meta:g.meta,progress:g.progress,image:g.image,color:g.color})));
    expect(legacy.find(g=>g.id==="g1")?.objectiveId).toBe("objective-trip");
    expect(legacy.find(g=>g.id==="g1")?.progress).toBe(75);
    expect(legacy.find(g=>g.id==="g2")?.progress).toBe(40);
  });
  it("computes hierarchical progress strictly from linked, active goals",()=>{
    const s=migrateStrategy(undefined);
    expect(objectiveProgress(s,goals,"objective-trip")).toBe(75);
    expect(milestoneProgress(s,goals,"milestone-trip")).toBe(75);
    expect(missionProgress(s,goals,"mission-adventure")).toBe(75);
    expect(missionProgress(s,goals,"mission-security")).toBe(50);
    expect(overallProgress(s,goals)).toBe(63);
    expect(relatedGoals(s,goals,"mission-security").map(g=>g.id).sort()).toEqual(["g2","g3"]);
  });
  it("does not invent progress for empty strategy branches",()=>{
    const s=migrateStrategy(undefined);
    expect(objectiveProgress(s,[],"objective-trip")).toBeNull();
    expect(missionProgress(s,[],"mission-adventure")).toBeNull();
    expect(overallProgress(s,[])).toBeNull();
    expect(overallProgress(s,[{...goals[0],status:"ARCHIVED"}])).toBeNull();
  });
  it("records date-stamped progress and handles completion and reopening",()=>{
    const first=recordGoalProgress(goals[0],100,"Trip funded","2026-10-31T07:00:00.000Z");
    expect(first.status).toBe("COMPLETED");
    expect(first.history).toHaveLength(1);
    expect(first.history?.[0].note).toBe("Trip funded");
    const reopen=recordGoalProgress(first,90,"Changed plan","2026-11-01T07:00:00.000Z");
    expect(reopen.status).toBe("ACTIVE");
    expect(reopen.history).toHaveLength(2);
    expect(goals[0].history).toHaveLength(0);
    expect(goalHistoryLabel(reopen.history![1])).toBe("Changed plan");
  });
  it("clamps progress and checks valid parent links",()=>{
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(112.3)).toBe(100);
    expect(clampProgress(NaN)).toBe(0);
    const s=migrateStrategy(undefined);
    expect(validParent(s,"milestone","mission-adventure")).toBe(true);
    expect(validParent(s,"objective","milestone-trip")).toBe(true);
    expect(validParent(s,"goal","objective-trip")).toBe(true);
    expect(validParent(s,"goal","invalid")).toBe(false);
    s.missions[0].status="ARCHIVED";
    expect(validParent(s,"milestone","mission-adventure")).toBe(false);
  });
});
