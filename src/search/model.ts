/**
 * Phase 8 cross-module search. A safe, navigation-first index for the public
 * frontend demonstration, NOT a global disclosure of family information.
 *
 * Intentional privacy boundary: membership, individual profiles, memories,
 * legacy, decisions, households, health, finance, and unlabelled records have
 * no globally searchable record-level representation in a no-auth prototype.
 * Users navigate to the relevant module for its context-specific search.
 */
import {navItems,type AppData} from "../data";
export type SearchArea="Navigation"|"Goals"|"Responsibilities"|"Calendar"|"Insights";
export type SearchEntry={
  id:string;title:string;subtitle:string;route:string;area:SearchArea;
  kind:"WORKSPACE"|"SHARED_RECORD";sourceId?:string;referenceDate?:string;
  accessibilityNote:string;
};
const sharedCategory=(category:string|undefined)=>category==="HOME"||category==="FAMILY";
const privateAreas=new Set(["Memory","Legacy","Family","Decisions","Traditions","Experiences"]);
export const privacyBoundaryText=
  "This public frontend has no identity or access control. Global search excludes member profiles, private memories, legacy, family decisions, and unclassified records. Search sensitive content only within its owning workspace; even there, privacy is not enforceable.";
export function buildSearchIndex(data:AppData):SearchEntry[]{
  const workspace:SearchEntry[]=navItems.filter(n=>n.label!=="Search")
    .map(n=>({id:"route:"+n.label,title:n.label,route:n.label,area:"Navigation",kind:"WORKSPACE",
      subtitle:privateAreas.has(n.label)?"Open workspace · private records are never globally indexed":"Open workspace · Phase "+n.phase,
      accessibilityNote:privateAreas.has(n.label)?"Navigation only; no private records indexed.":"Navigate to owning workspace."}));
  const tasks:SearchEntry[]=data.tasks.filter(t=>!t.archived&&sharedCategory(t.category)).map(t=>({
    id:"task:"+t.id,title:t.title,subtitle:"Shared responsibility · open task workspace",
    route:"Responsibilities",area:"Responsibilities",kind:"SHARED_RECORD",sourceId:t.id,
    referenceDate:t.dueDate,accessibilityNote:"Opens Responsibilities; no private member metadata included."}));
  const goals:SearchEntry[]=data.goals.filter(g=>g.status!=="ARCHIVED").map(g=>({
    id:"goal:"+g.id,title:g.title,subtitle:"Family goal · self-reported "+g.progress+"% progress",
    route:"Goals",area:"Goals",kind:"SHARED_RECORD",sourceId:g.id,referenceDate:g.targetDate,
    accessibilityNote:"Opens the Family Goals tab and searches by the title."}));
  const calendar:SearchEntry[]=data.events.filter(e=>e.status!=="CANCELLED"&&sharedCategory(e.category)&&!!e.date)
    .map(e=>({id:"event:"+e.id,title:e.title,subtitle:"Shared family calendar event",
      route:"Calendar",area:"Calendar",kind:"SHARED_RECORD",sourceId:e.id,referenceDate:e.date,
      accessibilityNote:"Opens the source calendar on its recorded date."}));
  return [...workspace,...tasks,...goals,...calendar];
}
const normalized=(value:string)=>value.toLocaleLowerCase().trim().replace(/\s+/g," ");
export function searchIndex(index:SearchEntry[],query:string,area:SearchArea|"All"="All",max=60):SearchEntry[]{
  const q=normalized(query);
  const terms=q.split(" ").filter(Boolean);
  const indexed=index.filter(e=>area==="All"||e.area===area);
  if(!terms.length)return indexed.filter(e=>e.kind==="WORKSPACE").slice(0,max);
  return indexed.map(item=>{
    const title=normalized(item.title),body=normalized(item.subtitle+" "+item.area);
    if(!terms.every(t=>title.includes(t)||body.includes(t)))return null;
    const score=title===q?0:title.startsWith(q)?1:title.includes(q)?2:
      item.kind==="WORKSPACE"?3:4;
    return {item,score};
  }).filter((value):value is {item:SearchEntry;score:number}=>value!==null)
    .sort((a,b)=>a.score-b.score||a.item.title.localeCompare(b.item.title))
    .slice(0,max).map(x=>x.item);
}
export function searchGroups(items:SearchEntry[]):{area:SearchArea;items:SearchEntry[]}[]{
  const order:SearchArea[]=["Navigation","Responsibilities","Calendar","Goals","Insights"];
  return order.map(area=>({area,items:items.filter(x=>x.area===area)})).filter(g=>g.items.length>0);
}
export function routeFromSearch(entry:SearchEntry):string {
  return navItems.some(n=>n.label===entry.route)?entry.route:"Dashboard";
}
export function locationFromSearch(entry:SearchEntry):{route:string;title:string;date:string;kind:SearchEntry["kind"]}{
  return {route:routeFromSearch(entry),title:entry.title,date:entry.referenceDate||"",kind:entry.kind};
}
