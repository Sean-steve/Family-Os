import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import IntelligenceWorkspace from "./IntelligenceWorkspace";
import {seed} from "../data";
describe("Phase 7 family intelligence experience",()=>{
  const render=()=>renderToStaticMarkup(<IntelligenceWorkspace data={seed} onChange={()=>undefined}
    onToast={()=>undefined} navigate={()=>undefined}/>);
  it("shows evidence-backed command center and honest coverage",()=>{
    const html=render();
    expect(html).toContain("Family Intelligence");
    expect(html).toContain("Your family");
    expect(html).toContain("current picture");
    expect(html).toContain("What deserves attention");
    expect(html).toContain("Evidence readiness");
    expect(html).toContain("Health / Nutrition OS");
    expect(html).toContain("Not connected");
  });
  it("provides navigation to signals, recommendations, briefs and deterministic assistant",()=>{
    const html=render();
    for(const tab of ["Signals","Recommendations","Briefings","Chief of Staff"]){
      expect(html).toContain(tab);
    }
    expect(html).toContain("no forecasts or estimated confidence");
    expect(html).toContain("No generative AI");
    expect(html).toContain("rule");
  });
});
