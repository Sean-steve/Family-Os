import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {seed} from "../data";
import FamilyLifeWorkspace from "./FamilyLifeWorkspace";
const base={data:seed,onChange:()=>undefined,onToast:()=>undefined,navigate:()=>undefined};
describe("Phase 6 family life UI",()=>{
  it("renders experiences and calendar/goal connections",()=>{
    const html=renderToStaticMarkup(<FamilyLifeWorkspace route="Experiences" {...base}/>);
    expect(html).toContain("Family Experiences");
    expect(html).toContain("Riverside family picnic");
    expect(html).toContain("Capture memory");
    expect(html).toContain("Add to calendar");
    expect(html).toContain("Fictional frontend preview");
  });
  it("renders memory timeline and explicitly warns that labels are not privacy",()=>{
    const html=renderToStaticMarkup(<FamilyLifeWorkspace route="Memory" {...base}/>);
    expect(html).toContain("Moments worth remembering");
    expect(html).toContain("A sunny afternoon by the river");
    expect(html).toContain("Add to legacy");
    expect(html).toContain("Consent review needed");
    expect(html).toContain("not access controls");
  });
  it("renders recurring traditions and memory capture",()=>{
    const html=renderToStaticMarkup(<FamilyLifeWorkspace route="Traditions" {...base}/>);
    expect(html).toContain("Our Family Traditions");
    expect(html).toContain("Family games evening");
    expect(html).toContain("Record moment");
    expect(html).toContain("Tell a story");
  });
  it("renders legacy types and makes lack of secure release explicit",()=>{
    const html=renderToStaticMarkup(<FamilyLifeWorkspace route="Legacy" {...base}/>);
    expect(html).toContain("Our Family Legacy");
    expect(html).toContain("Kindness is how we show up");
    expect(html).toContain("Add a Legacy Entry");
    expect(html).toContain("not hidden, secured or scheduled");
  });
});
