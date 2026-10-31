import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"**/*.pw.ts",
  timeout:30000,
  expect:{timeout:10000},
  fullyParallel:false,
  forbidOnly:!!process.env.CI,
  retries:process.env.CI?1:0,
  workers:process.env.CI?2:undefined,
  reporter:process.env.CI?[["list"],["html",{open:"never",outputFolder:"playwright-report"}]]:"list",
  use:{
    baseURL:"http://127.0.0.1:4173/Family-Os/",
    trace:"retain-on-failure",
    screenshot:"only-on-failure"
  },
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:900}}}],
  webServer:{
    command:"npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url:"http://127.0.0.1:4173/Family-Os/",
    reuseExistingServer:!process.env.CI,
    timeout:120000
  }
});
