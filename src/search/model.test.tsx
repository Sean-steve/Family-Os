import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {seed} from "../data";
import GlobalSearch from "./GlobalSearch";
import {buildSearchIndex,locationFromSearch,privacyBoundaryText,routeFromSearch,searchGroups,searchIndex} from "./model";
describe("Phase 8 privacy-aware search",()=>{
  it("indexes navigable modules and selected explicitly shared records only",()=>{
    const d=structuredClone(seed);
    d.tasks.push(
      {id:"shared-task",title:"Plan shared dinner",person:"",done:false,due:"Today",category:"HOME",dueDate:"2026-11-02"},
      {id:"private-health",title:"Confidential personal medical issue",person:"",done:false,due:"Today",category:"HEALTH",dueDate:"2026-11-02"},
      {id:"unclassified",title:"Private unspecified note",person:"",done:false,due:"Today",dueDate:"2026-11-02"}
    );
    d.events.push(
      {id:"shared-event",title:"Household picnic",date:"2026-11-02",time:"15:00",note:"",
        attendees:[],color:"#fff",category:"FAMILY",status:"ACTIVE"},
      {id:"private-event",title:"Personal confidential appointment",date:"2026-11-02",time:"15:00",note:"",
        attendees:[],color:"#fff",category:"HEALTH",status:"ACTIVE"}
    );
    const index=buildSearchIndex(d),text=JSON.stringify(index);
    expect(index.some(x=>x.route==="Family"&&x.kind==="WORKSPACE")).toBe(true);
    expect(index.some(x=>x.route==="Memory"&&x.kind==="WORKSPACE")).toBe(true);
    expect(index.some(x=>x.route==="Legacy"&&x.kind==="WORKSPACE")).toBe(true);
    expect(index.some(x=>x.route==="Decisions"&&x.kind==="WORKSPACE")).toBe(true);
    expect(index.some(x=>x.id==="task:shared-task")).toBe(true);
    expect(index.some(x=>x.id==="event:shared-event")).toBe(true);
    expect(index.some(x=>x.id==="goal:g1")).toBe(true);
    expect(text).not.toContain("Confidential personal medical issue");
    expect(text).not.toContain("Private unspecified note");
    expect(text).not.toContain("Personal confidential appointment");
    expect(text).not.toContain(d.life.memories[0].title);
    expect(text).not.toContain(d.life.legacy[0].title);
    expect(text).not.toContain(d.governance.decisions[0].title);
    expect(text).not.toContain(d.members[0].name);
  });
  it("excludes archived/cancelled records and avoids leaking member assignment or notes",()=>{
    const d=structuredClone(seed);
    d.tasks.push({id:"assigned",title:"Shared garden",person:"Sensitive private name",due:"Today",
      done:false,dueDate:"2026-11-02",category:"HOME",assigneeIds:["noah"]});
    d.events.push({id:"cancel",title:"Cancelled event",time:"12:00",color:"#fff",note:"",
      attendees:[],category:"FAMILY",date:"2026-11-02",status:"CANCELLED"});
    d.goals[0].status="ARCHIVED";
    const text=JSON.stringify(buildSearchIndex(d));
    expect(text).toContain("Shared garden");
    expect(text).not.toContain("Sensitive private name");
    expect(text).not.toContain("noah");
    expect(text).not.toContain("Cancelled event");
    expect(text).not.toContain("Europe Family Trip");
  });
  it("ranks exact workspace matches before weaker descriptions and supports token search",()=>{
    const index=buildSearchIndex(seed);
    const goal=searchIndex(index,"goals");
    expect(goal[0].title).toBe("Goals");
    expect(searchIndex(index,"Family Goals").length).toBeGreaterThan(0);
    expect(searchIndex(index,"Memory")[0].route).toBe("Memory");
    expect(searchIndex(index,"", "Navigation").every(x=>x.kind==="WORKSPACE")).toBe(true);
    expect(searchGroups(searchIndex(index,"", "All")).some(g=>g.area==="Navigation")).toBe(true);
  });
  it("hands a result to an allowed route, date and context only",()=>{
    const goals=buildSearchIndex(seed).find(x=>x.id==="goal:g1")!;
    expect(locationFromSearch(goals)).toEqual({route:"Goals",title:goals.title,date:"",kind:"SHARED_RECORD"});
    expect(routeFromSearch({...goals,route:"Somewhere private"})).toBe("Dashboard");
    expect(privacyBoundaryText).toMatch(/no identity or access control/i);
  });
  it("renders full route search and modal with privacy boundary and accessible controls",()=>{
    const html=renderToStaticMarkup(<GlobalSearch data={seed} mode="page" onSelect={()=>undefined}/>);
    expect(html).toContain("Find your next destination");
    expect(html).toContain("Search family workspaces and shared records");
    expect(html).toContain("Privacy limitation");
    expect(html).toContain("role=\"listbox\"");
    const modal=renderToStaticMarkup(<GlobalSearch data={seed} mode="modal" onSelect={()=>undefined}/>);
    expect(modal).toContain("aria-modal=\"true\"");
    expect(modal).toContain("Family OS");
  });
});
