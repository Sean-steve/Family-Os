import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {seed} from "../data";
import SettingsWorkspace from "./SettingsWorkspace";
describe("Phase 8 preview privacy settings",()=>{
  it("renders unencrypted-storage warnings, record counts, theme controls and irreversible reset boundary",()=>{
    const html=renderToStaticMarkup(<SettingsWorkspace data={seed} dark={false}
      onTheme={()=>undefined} onReset={()=>undefined} navigate={()=>undefined}/>);
    for(const text of ["Preview Settings","LocalStorage is not private family storage",
      "Browser data snapshot","Family members","Decision drafts","Memory stories","Legacy entries",
      "Restore fictional sample data","Reset browser preview","No real login"]){
      expect(html).toContain(text);
    }
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("No secure family account");
  });
});
