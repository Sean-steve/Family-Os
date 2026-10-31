import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async({page})=>{
  await page.goto("/Family-Os/#/Dashboard");
  await expect(page.getByRole("navigation",{name:"Main navigation"})).toBeVisible();
});

test("dashboard tells the truth about missing integrations and sample data",async({page})=>{
  await expect(page.getByText("Evidence & Connections")).toBeVisible();
  await expect(page.getByText("No connected Health OS, Finance OS or HumanKernelOS")).toBeVisible();
  await expect(page.getByText("No upcoming explicitly dated shared events")).toBeVisible();
  await expect(page.getByText("23% more consistent")).toHaveCount(0);
  await expect(page.getByText("Increased workload next week")).toHaveCount(0);
  await expect(page.getByText("Summer holiday destination")).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Skip to main content"})).toHaveAttribute("href","#family-main");
});

test("all Phase 1–7 workspaces have real frontend screens and no placeholder route",async({page})=>{
  const cases:[string,string][]=[
    ["Dashboard","dashboard"],["Family","family-workspace"],["Plan","ops-workspace"],
    ["Calendar","ops-workspace"],["Responsibilities","ops-workspace"],["Routines","ops-workspace"],
    ["Goals","st-workspace"],["Decisions","gv-workspace"],["Experiences","lf-workspace"],
    ["Memory","lf-workspace"],["Traditions","lf-workspace"],["Legacy","lf-workspace"],
    ["Insights","in-workspace"],["Search","se-page"]
  ];
  for(const [route,cls] of cases){
    await page.goto("/Family-Os/#/"+encodeURIComponent(route));
    await expect(page.locator("."+cls).first()).toBeVisible();
    await expect(page.locator(".phase-note")).toHaveCount(0);
    await expect(page.getByRole("navigation",{name:"Main navigation"}).getByRole("button",{name:route,exact:true})).toBeVisible();
  }
});

test("Ctrl-K searches family goals and opens their owning tab, not a generic placeholder",async({page})=>{
  await page.keyboard.press("Control+k");
  const dialog=page.getByRole("dialog",{name:"Search dialog"});
  await expect(dialog).toBeVisible();
  const input=dialog.getByRole("combobox",{name:"Search family workspaces and shared records"});
  await expect(input).toBeFocused();
  await input.fill("Europe Family Trip");
  await expect(dialog.getByRole("option",{name:/Europe Family Trip/})).toBeVisible();
  await dialog.getByRole("option",{name:/Europe Family Trip/}).click();
  await expect(page).toHaveURL(/#\/Goals$/);
  await expect(page.locator(".st-tabs .selected")).toContainText("Goals");
  await expect(page.getByPlaceholder("Search family goals")).toHaveValue("Europe Family Trip");
});

test("universal search hands an explicitly shared task to its source filter and date",async({page})=>{
  await page.evaluate(()=>{
    const key="family-os-preview-v1";
    const state=JSON.parse(localStorage.getItem(key)||"{}");
    state.tasks.push({id:"phase8-shared",title:"Arrange the family picnic",
      description:"Demo shared item",person:"",due:"Today",done:false,category:"HOME",
      dueDate:"2026-11-08",assigneeIds:[],householdId:"",priority:"MEDIUM",repeat:"NONE"});
    localStorage.setItem(key,JSON.stringify(state));
  });
  await page.reload();
  await page.keyboard.press("Control+k");
  const dialog=page.getByRole("dialog",{name:"Search dialog"});
  await dialog.getByRole("combobox").fill("Arrange the family picnic");
  await dialog.getByRole("option",{name:/Arrange the family picnic/}).click();
  await expect(page).toHaveURL(/#\/Responsibilities$/);
  await expect(page.getByRole("textbox",{name:"Search responsibilities"})).toHaveValue("Arrange the family picnic");
});

test("global search excludes personal, legacy and unclassified record content",async({page})=>{
  await page.keyboard.press("Control+k");
  const dialog=page.getByRole("dialog",{name:"Search dialog"});
  const input=dialog.getByRole("combobox");
  await input.fill("Kindness is how we show up");
  await expect(dialog.getByText("No matching shared records or workspaces")).toBeVisible();
  await input.fill("A sunny afternoon by the river");
  await expect(dialog.getByText("No matching shared records or workspaces")).toBeVisible();
  await input.fill("Memory");
  await expect(dialog.getByRole("option",{name:/Memory/})).toBeVisible();
  await expect(dialog.getByText("Private records are not indexed here")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("search page responds to keyboard, mobile nav works and theme persists",async({page})=>{
  await page.goto("/Family-Os/#/Search");
  const input=page.getByRole("combobox",{name:"Search family workspaces and shared records"});
  await input.fill("Goals");
  await input.press("Enter");
  await expect(page).toHaveURL(/#\/Goals$/);
  const theme=page.getByRole("button",{name:"Switch to dark theme"});
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Open navigation"}).click();
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("button",{name:"Insights"}).click();
  await expect(page).toHaveURL(/#\/Insights$/);
  await expect(page.locator(".in-workspace")).toBeVisible();
});

test("preview does not request third-party photo, font or external profile hosts",async({page})=>{
  const external:string[]=[];
  page.on("request",request=>{
    try{const url=new URL(request.url());if(url.protocol.startsWith("http")&&!["127.0.0.1","localhost"].includes(url.hostname)){
      external.push(url.hostname);
    }}catch{/* internal only */}
  });
  for(const route of ["Dashboard","Family","Goals","Legacy"]){
    await page.goto("/Family-Os/#/"+route);
    await expect(page.locator("main").first()).toBeVisible();
  }
  expect(external).toEqual([]);
});

test("search and command center pass automated serious/critical WCAG semantics (contrast separately audited)",async({page})=>{
  await page.goto("/Family-Os/#/Search");
  const result=await new AxeBuilder({page}).include(".se-shell")
    .withTags(["wcag2a","wcag2aa"]).disableRules(["color-contrast"]).analyze();
  expect(result.violations.filter(v=>["critical","serious"].includes(v.impact||""))).toEqual([]);
});

test("preview Settings expose local security limits and require explicit reset confirmation",async({page})=>{
  await page.goto("/Family-Os/#/Settings");
  await expect(page.getByText("LocalStorage is not private family storage.")).toBeVisible();
  await expect(page.getByText("Restore fictional sample data")).toBeVisible();
  await page.getByRole("button",{name:"Reset browser preview"}).click();
  const dialog=page.getByRole("dialog",{name:"Confirm reset sample data"});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Reset sample dataset"})).toBeDisabled();
  await dialog.getByRole("textbox",{name:"Type RESET to confirm"}).fill("RESET");
  await dialog.getByRole("button",{name:"Reset sample dataset"}).click();
  await expect(page).toHaveURL(/#\/Dashboard$/);
  await expect(page.getByRole("dialog",{name:"Confirm reset sample data"})).toHaveCount(0);
});

test("complete family journey: experience -> calendar -> memory -> legacy with canonical links",async({page})=>{
  const title="Phase 8 family picnic";
  await page.goto("/Family-Os/#/Experiences");
  await page.getByRole("button",{name:"Plan an Experience"}).click();
  const expForm=page.getByRole("dialog",{name:"Experience editor"});
  await expForm.getByLabel("Experience name").fill(title);
  await expForm.getByLabel("Stage").selectOption("PLANNED");
  await expForm.getByLabel("Date").fill("2026-11-08");
  await expForm.getByLabel("Time",{exact:true}).fill("14:00");
  await expForm.getByLabel("What should we experience together?").fill("A fictional afternoon picnic to demonstrate connected records.");
  await expForm.getByRole("button",{name:"Save Experience"}).click();
  const expCard=page.locator(".lf-experience-card").filter({hasText:title});
  await expect(expCard).toBeVisible();
  await expCard.getByRole("button",{name:"Add to calendar"}).click();
  await expect(expCard.getByText("Calendar link")).toBeVisible();
  await expCard.getByRole("button",{name:"Mark experienced"}).click();
  await expCard.getByRole("button",{name:"Capture memory"}).click();
  const memoryForm=page.getByRole("dialog",{name:"Memory editor"});
  await expect(memoryForm.getByLabel("Memory title")).toHaveValue(title);
  await memoryForm.getByRole("button",{name:"Save Memory"}).click();
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("button",{name:"Memory"}).click();
  const memoryCard=page.locator(".lf-memory-card").filter({hasText:title});
  await expect(memoryCard).toBeVisible();
  await memoryCard.getByRole("button",{name:"Add to legacy"}).click();
  const legacyForm=page.getByRole("dialog",{name:"Legacy editor"});
  await expect(legacyForm.getByLabel("Legacy entry title")).toHaveValue(title);
  await legacyForm.getByRole("button",{name:"Save Legacy"}).click();
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("button",{name:"Legacy"}).click();
  await expect(page.locator(".lf-legacy-card").filter({hasText:title})).toBeVisible();
  const consistency=await page.evaluate((name)=>{
    const s=JSON.parse(localStorage.getItem("family-os-preview-v1")||"{}");
    const exp=s.life.experiences.find((e:{title:string})=>e.title===name);
    const memory=s.life.memories.find((m:{experienceId:string})=>m.experienceId===exp.id);
    const legacy=s.life.legacy.find((l:{linkedMemoryIds:string[]})=>l.linkedMemoryIds.includes(memory.id));
    return {calendarLinked:s.events.some((e:{id:string})=>e.id===exp.linkedEventId),
      memoryLinked:!!memory,legacyLinked:!!legacy,
      eventCount:s.events.filter((e:{id:string})=>e.id===exp.linkedEventId).length};
  },title);
  expect(consistency).toEqual({calendarLinked:true,memoryLinked:true,legacyLinked:true,eventCount:1});
  await page.reload();
  await expect(page.locator(".lf-legacy-card").filter({hasText:title})).toBeVisible();
});
