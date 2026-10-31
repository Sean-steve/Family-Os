import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { seed } from "../data";
import OperationsWorkspace from "./OperationsWorkspace";

const base={data:seed,onChange:()=>undefined,onToast:()=>undefined,navigate:()=>undefined};
describe("Phase 3 screens render",()=>{
  it("renders the planning and coordination space",()=>{
    const html=renderToStaticMarkup(<OperationsWorkspace route="Plan" {...base}/>);
    expect(html).toContain("Family Coordination");
    expect(html).toContain("Family Huddle");
    expect(html).toContain("Family Rhythms");
    expect(html).toContain("Responsibilities today");
    expect(html).toContain("Frontend-only preview");
  });
  it("renders calendar month, week controls and agenda",()=>{
    const html=renderToStaticMarkup(<OperationsWorkspace route="Calendar" {...base}/>);
    expect(html).toContain("Everyone");
    expect(html).toContain("Month");
    expect(html).toContain("Week");
    expect(html).toContain("Add to this day");
    expect(html).toContain("SHARED FAMILY CALENDAR");
  });
  it("renders responsibilities with categories and completion",()=>{
    const html=renderToStaticMarkup(<OperationsWorkspace route="Responsibilities" {...base}/>);
    expect(html).toContain("Share the work");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Mark complete");
  });
  it("renders routines with steps and clear privacy notes",()=>{
    const html=renderToStaticMarkup(<OperationsWorkspace route="Routines" {...base}/>);
    expect(html).toContain("Routines that make room for life");
    expect(html).toContain("School morning rhythm");
    expect(html).toContain("Steps completed");
    expect(html).toContain("browser");
  });
});
