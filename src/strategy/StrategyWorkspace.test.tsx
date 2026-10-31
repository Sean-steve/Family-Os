import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {seed} from "../data";
import StrategyWorkspace from "./StrategyWorkspace";
describe("Phase 4 Family Strategy experience",()=>{
  it("renders the dashboard-linked family vision, mission and goal overview",()=>{
    const html=renderToStaticMarkup(<StrategyWorkspace data={seed} onChange={()=>undefined} onToast={()=>undefined} navigate={()=>undefined}/>);
    expect(html).toContain("Our family");
    expect(html).toContain("The big picture");
    expect(html).toContain("Our Family Vision");
    expect(html).toContain("Our Missions");
    expect(html).toContain("Goal Momentum");
    expect(html).toContain("75%");
  });
  it("shows each real Phase 4 strategy destination and honest preview boundaries",()=>{
    const html=renderToStaticMarkup(<StrategyWorkspace data={seed} onChange={()=>undefined} onToast={()=>undefined} navigate={()=>undefined}/>);
    for(const t of ["Vision &amp; Values","Missions","Milestones","Objectives","Goals","Reviews"]){
      expect(html).toContain(t);
    }
    expect(html).toContain("Interactive frontend preview");
    expect(html).toContain("No backend");
  });
});
