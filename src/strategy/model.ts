/**
 * Family OS Phase 4 — frontend strategy model (not a backend/authorization contract).
 * Vision -> Missions -> Milestones -> Objectives -> Goals.
 * Goals remain canonical in AppData.goals. Do not copy them into strategy.
 */
import type { Goal } from "../data";
export type StrategyStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type FamilyVision = {
  id:string; title:string; statement:string; horizon:string; status:StrategyStatus;
  revision:number; updatedAt:string; history:{statement:string;changedAt:string}[];
};
export type FamilyValue = {
  id:string; title:string; description:string; symbol:string; priority:number; archived:boolean;
};
export type Mission = {
  id:string; title:string; description:string; status:StrategyStatus; valueIds:string[];
  ownerIds:string[]; targetDate:string; priority:"HIGH"|"MEDIUM"|"LOW";
};
export type Milestone = {
  id:string; missionId:string; title:string; description:string; targetDate:string;
  status:StrategyStatus; completedAt:string;
};
export type Objective = {
  id:string; milestoneId:string; title:string; description:string; targetDate:string;
  status:StrategyStatus; ownerIds:string[]; metric:string; target:string;
};
export type StrategyReview = {
  id:string; date:string; title:string; wins:string; challenges:string;
  nextSteps:string; ownerId:string;
};
export type StrategyState = {
  vision:FamilyVision; values:FamilyValue[]; missions:Mission[];
  milestones:Milestone[]; objectives:Objective[]; reviews:StrategyReview[];
};
export type GoalProgressEntry = { at:string; progress:number; note:string };
export type GoalExtension = {
  objectiveId?:string; description?:string; targetDate?:string; ownerIds?:string[];
  status?:StrategyStatus; history?:GoalProgressEntry[];
};
export function strategyToday():string {
  const entries=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=(type:string)=>entries.find(e=>e.type===type)?.value||"";
  return part("year")+"-"+part("month")+"-"+part("day");
}
export const seedStrategy:StrategyState={
  vision:{
    id:"vision-main",title:"Our family vision",
    statement:"To grow together with kindness, security, curiosity, and shared experiences — while creating a meaningful legacy for those who come after us.",
    horizon:"The next 5 years",status:"ACTIVE",revision:1,
    updatedAt:"",history:[]
  },
  values:[
    {id:"value-kindness",title:"Kindness",description:"We listen, care and make room for one another.",symbol:"heart",priority:1,archived:false},
    {id:"value-together",title:"Togetherness",description:"We show up for each other and make time to connect.",symbol:"users",priority:2,archived:false},
    {id:"value-growth",title:"Growth",description:"We stay curious and help one another learn.",symbol:"sprout",priority:3,archived:false},
    {id:"value-security",title:"Security",description:"We plan ahead and care for our family's future.",symbol:"shield",priority:4,archived:false}
  ],
  missions:[
    {id:"mission-adventure",title:"Create meaningful family experiences",description:"Make time for shared adventures and lifelong memories.",
      status:"ACTIVE",valueIds:["value-together","value-growth"],ownerIds:["alex","jamie"],targetDate:"2027-12-31",priority:"HIGH"},
    {id:"mission-security",title:"Build a resilient family foundation",description:"Develop healthy habits and strengthen practical security.",
      status:"ACTIVE",valueIds:["value-security","value-kindness"],ownerIds:["alex","jamie"],targetDate:"2028-12-31",priority:"HIGH"}
  ],
  milestones:[
    {id:"milestone-trip",missionId:"mission-adventure",title:"Plan and fund our next big family adventure",
      description:"Agree on a destination, plan the trip and get ready together.",targetDate:"2027-08-31",status:"ACTIVE",completedAt:""},
    {id:"milestone-reserve",missionId:"mission-security",title:"Build practical family security",
      description:"Make progress toward financial resilience.",targetDate:"2027-12-31",status:"ACTIVE",completedAt:""},
    {id:"milestone-habits",missionId:"mission-security",title:"Grow healthier family routines",
      description:"Build habits that fit our daily lives.",targetDate:"2027-06-30",status:"ACTIVE",completedAt:""}
  ],
  objectives:[
    {id:"objective-trip",milestoneId:"milestone-trip",title:"Prepare for the Europe family trip",
      description:"Plan and save for a memorable family trip.",targetDate:"2027-07-31",status:"ACTIVE",ownerIds:["alex","jamie"],metric:"Trip planning progress",target:"100%"},
    {id:"objective-reserve",milestoneId:"milestone-reserve",title:"Strengthen our emergency savings",
      description:"Work toward a family emergency fund.",targetDate:"2027-12-31",status:"ACTIVE",ownerIds:["alex","jamie"],metric:"Goal completion",target:"100%"},
    {id:"objective-habits",milestoneId:"milestone-habits",title:"Practice consistent family habits",
      description:"Improve family wellness through small commitments.",targetDate:"2027-06-30",status:"ACTIVE",ownerIds:["alex","jamie"],metric:"Habit goal completion",target:"100%"}
  ],
  reviews:[]
};
export function migrateStrategy(raw:unknown):StrategyState {
  const initial=structuredClone(seedStrategy);
  if(!raw||typeof raw!=="object")return initial;
  const value=raw as Partial<StrategyState>;
  return {
    vision:value.vision&&typeof value.vision==="object" ? {
      ...initial.vision,...value.vision,history:Array.isArray(value.vision.history)?value.vision.history:[]
    } : initial.vision,
    values:Array.isArray(value.values)?value.values:initial.values,
    missions:Array.isArray(value.missions)?value.missions:initial.missions,
    milestones:Array.isArray(value.milestones)?value.milestones:initial.milestones,
    objectives:Array.isArray(value.objectives)?value.objectives:initial.objectives,
    reviews:Array.isArray(value.reviews)?value.reviews:initial.reviews
  };
}
export function normalizedGoals(goals:Goal[]):Goal[] {
  return goals.map(goal => ({...goal,
    objectiveId:goal.objectiveId===undefined?seedGoalObjectiveMap[goal.id]||"":goal.objectiveId,
    status:goal.status||"ACTIVE",
    history:Array.isArray(goal.history)?goal.history:[],
    ownerIds:Array.isArray(goal.ownerIds)?goal.ownerIds:[],
  }));
}
const seedGoalObjectiveMap:Record<string,string>={
  g1:"objective-trip",g2:"objective-reserve",g3:"objective-habits"
};
export function progressOf(goals:(Goal&GoalExtension)[]):number|null {
  const eligible=goals.filter(g=>g.status!=="ARCHIVED"&&g.status!=="DRAFT");
  if(!eligible.length)return null;
  return Math.round(eligible.reduce((sum,g)=>sum+clampProgress(g.progress),0)/eligible.length);
}
export function objectiveProgress(s:StrategyState,goals:Goal[],id:string):number|null {
  return progressOf(goals.filter(g=>g.objectiveId===id));
}
export function milestoneProgress(s:StrategyState,goals:Goal[],id:string):number|null {
  const children=s.objectives.filter(o=>o.milestoneId===id&&o.status!=="ARCHIVED");
  const percentages=children.map(o=>objectiveProgress(s,goals,o.id)).filter((v):v is number=>v!==null);
  return percentages.length?Math.round(percentages.reduce((a,b)=>a+b,0)/percentages.length):null;
}
export function missionProgress(s:StrategyState,goals:Goal[],id:string):number|null {
  const children=s.milestones.filter(m=>m.missionId===id&&m.status!=="ARCHIVED");
  const percentages=children.map(m=>milestoneProgress(s,goals,m.id)).filter((v):v is number=>v!==null);
  return percentages.length?Math.round(percentages.reduce((a,b)=>a+b,0)/percentages.length):null;
}
export function overallProgress(s:StrategyState,goals:Goal[]):number|null {
  const percentages=s.missions.filter(m=>m.status!=="ARCHIVED").map(m=>missionProgress(s,goals,m.id)).filter((v):v is number=>v!==null);
  return percentages.length?Math.round(percentages.reduce((a,b)=>a+b,0)/percentages.length):null;
}
export function clampProgress(n:number):number {
  return Math.min(100,Math.max(0,Number.isFinite(n)?Math.round(n):0));
}
export function recordGoalProgress(goal:Goal&GoalExtension,value:number,note:string,at:string):Goal {
  const progress=clampProgress(value);
  if(progress===goal.progress&&!note.trim())return goal;
  return {...goal,progress,
    status:goal.status==="COMPLETED"&&progress<100?"ACTIVE":progress===100?"COMPLETED":goal.status||"ACTIVE",
    history:[...(goal.history||[]),{at,progress,note:note.trim()}].slice(-100)};
}
export function validParent(s:StrategyState,level:"milestone"|"objective"|"goal",parentId:string):boolean {
  if(!parentId)return true; // unlinked / draft allowed
  if(level==="milestone")return s.missions.some(m=>m.id===parentId&&m.status!=="ARCHIVED");
  if(level==="objective")return s.milestones.some(m=>m.id===parentId&&m.status!=="ARCHIVED");
  return s.objectives.some(o=>o.id===parentId&&o.status!=="ARCHIVED");
}
export function relatedGoals(s:StrategyState,goals:Goal[],missionId:string):Goal[] {
  const milestoneIds=new Set(s.milestones.filter(m=>m.missionId===missionId).map(m=>m.id));
  const objectiveIds=new Set(s.objectives.filter(o=>milestoneIds.has(o.milestoneId)).map(o=>o.id));
  return goals.filter(g=>objectiveIds.has(g.objectiveId||""));
}
export function goalHistoryLabel(entry:GoalProgressEntry):string {
  return entry.note||("Progress updated to "+entry.progress+"%");
}
