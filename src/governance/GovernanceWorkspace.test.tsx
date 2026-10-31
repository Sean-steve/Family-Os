import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import GovernanceWorkspace from "./GovernanceWorkspace";
import {seed} from "../data";
describe("Phase 5 Governance experience",()=>{
  const render=()=>renderToStaticMarkup(<GovernanceWorkspace data={seed} onChange={()=>undefined}
    onToast={()=>undefined} navigate={()=>undefined}/>);
  it("renders Family Governance command center and decision queue",()=>{
    const html=render();
    expect(html).toContain("A stronger family");
    expect(html).toContain("Awaiting Family Input");
    expect(html).toContain("Our Family Constitution");
    expect(html).toContain("Guidelines We Share");
    expect(html).toContain("Where should we go");
  });
  it("makes all governance workspaces navigable with explicit preview boundaries",()=>{
    const html=render();
    for(const item of ["Decisions","Constitution","Policies","Family Meetings","Activity"])expect(html).toContain(item);
    expect(html).toContain("Frontend governance simulation");
    expect(html).toContain("NOT authenticated");
    expect(html).toContain("Select preview family participant");
  });
});
