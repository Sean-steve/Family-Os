/**
 * Family OS Phase 6 — Life, experiences, memories, traditions and legacy.
 * Browser-local design prototype. Visibility/consent labels are NOT enforcement.
 * Never use this preview for sensitive people, child, medical or legal records.
 */
import type { PlanEvent } from "../data";
export type LifeVisibility="FAMILY_LABEL"|"PRIVATE_LABEL"|"REVIEW_FIRST";
export type ConsentPreview="NOT_RECORDED"|"REVIEW_NEEDED"|"ACKNOWLEDGED_LABEL";
export type ExperienceType="TRAVEL"|"CELEBRATION"|"LEARNING"|"OUTDOORS"|"TOGETHER"|"OTHER";
export type ExperienceStatus="IDEA"|"PLANNED"|"COMPLETED"|"CANCELLED";
export type Experience={
  id:string;title:string;summary:string;type:ExperienceType;status:ExperienceStatus;
  date:string;time:string;location:string;householdId:string;memberIds:string[];
  linkedGoalId:string;linkedEventId:string;notes:string;createdAt:string;archived:boolean;
};
export type Memory={
  id:string;title:string;story:string;date:string;experienceId:string;traditionId:string;
  memberIds:string[];tags:string[];visibility:LifeVisibility;consent:ConsentPreview;
  status:"DRAFT"|"RECORDED"|"ARCHIVED";createdAt:string;
  /** Metadata for prototype illustrations only: no uploads, actual photo files or external personal photos. */
  mediaCaption:string;mediaKind:"NONE"|"PHOTO_PLACEHOLDER"|"VIDEO_PLACEHOLDER";
};
export type TraditionCadence="WEEKLY"|"MONTHLY"|"YEARLY"|"OCCASIONAL";
export type TraditionMoment={id:string;date:string;note:string;memoryId:string};
export type Tradition={
  id:string;title:string;meaning:string;cadence:TraditionCadence;
  month:number;day:number;weekday:number;householdId:string;memberIds:string[];
  active:boolean;moments:TraditionMoment[];createdAt:string;
};
export type LegacyKind="STORY"|"WISDOM"|"HEIRLOOM"|"LETTER"|"CAPSULE";
export type LegacyRecord={
  id:string;kind:LegacyKind;title:string;summary:string;content:string;
  custodianId:string;memberIds:string[];linkedMemoryIds:string[];
  visibility:LifeVisibility;status:"DRAFT"|"PRESERVED"|"ARCHIVED";
  intendedRevealDate:string;createdAt:string;updatedAt:string;
};
export type FamilyLifeState={
  experiences:Experience[];memories:Memory[];traditions:Tradition[];legacy:LegacyRecord[];
};
export const experienceTypes:Record<ExperienceType,string>={
  TRAVEL:"Travel & getaways",CELEBRATION:"Celebrations",LEARNING:"Learning",
  OUTDOORS:"Outdoors",TOGETHER:"Family time",OTHER:"Other"
};
export const traditionCadences:Record<TraditionCadence,string>={
  WEEKLY:"Weekly",MONTHLY:"Monthly",YEARLY:"Yearly",OCCASIONAL:"Occasional"
};
export const legacyKinds:Record<LegacyKind,string>={
  STORY:"Family story",WISDOM:"Family wisdom",HEIRLOOM:"Heirloom record",LETTER:"Letter",
  CAPSULE:"Time capsule (preview)"
};
export const visibilityLabels:Record<LifeVisibility,string>={
  FAMILY_LABEL:"Family-labelled",PRIVATE_LABEL:"Private-labelled (NOT protected)",
  REVIEW_FIRST:"Review required (NOT enforced)"
};
export const consentLabels:Record<ConsentPreview,string>={
  NOT_RECORDED:"Consent not documented",
  REVIEW_NEEDED:"Consent review needed",
  ACKNOWLEDGED_LABEL:"Consent acknowledged (self-reported)"
};
export function lifeDate():string{
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const v=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return v("year")+"-"+v("month")+"-"+v("day");
}
export function validDate(value:string):boolean {
  const match=/^(\d{4})-(\d\d)-(\d\d)$/.exec(value);
  if(!match)return false;
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));
  return date.toISOString().slice(0,10)===value;
}
export function uniqueIds(ids:string[]):string[]{return [...new Set(ids.filter(Boolean))];}
export const freshLifeId=(prefix:string)=>prefix+(typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));
export const seedLife:FamilyLifeState={
  experiences:[
    {id:"exp-picnic",title:"Riverside family picnic",summary:"A relaxed afternoon outdoors with our favourite shared games.",
      type:"OUTDOORS",status:"COMPLETED",date:"2026-10-04",time:"12:00",location:"Local park",
      householdId:"household-home",memberIds:["alex","jamie","sam","ella","noah"],
      linkedGoalId:"g3",linkedEventId:"",notes:"Bring snacks, a blanket and a ball.",
      createdAt:"2026-09-25",archived:false},
    {id:"exp-winter",title:"Plan our next family adventure",summary:"Choose a destination and build a memorable trip together.",
      type:"TRAVEL",status:"IDEA",date:"2027-07-18",time:"09:00",location:"To be decided",
      householdId:"household-home",memberIds:["alex","jamie","sam","ella","noah"],
      linkedGoalId:"g1",linkedEventId:"",notes:"Keep the destination and budget realistic.",
      createdAt:"2026-10-01",archived:false},
    {id:"exp-game",title:"Family board-game afternoon",summary:"A simple afternoon of games and conversation.",
      type:"TOGETHER",status:"PLANNED",date:"2026-11-08",time:"15:00",location:"Family home",
      householdId:"household-home",memberIds:["alex","jamie","sam","ella","noah"],
      linkedGoalId:"",linkedEventId:"",notes:"Everyone chooses one favourite game.",
      createdAt:"2026-10-15",archived:false}
  ],
  memories:[
    {id:"memory-picnic",title:"A sunny afternoon by the river",
      story:"We took some time away from the routine and enjoyed being outdoors together. The little moments were our favourite part.",
      date:"2026-10-04",experienceId:"exp-picnic",traditionId:"",memberIds:["alex","jamie","sam","ella","noah"],
      tags:["Outdoors","Togetherness"],visibility:"REVIEW_FIRST",consent:"REVIEW_NEEDED",
      status:"RECORDED",createdAt:"2026-10-05",mediaCaption:"Sample photo placeholder — no actual family image stored",
      mediaKind:"PHOTO_PLACEHOLDER"},
    {id:"memory-laughs",title:"The game night that made us laugh",
      story:"A fun night of friendly competition, snacks and an unexpected comeback in the final game.",
      date:"2026-09-19",experienceId:"",traditionId:"trad-game",memberIds:["alex","jamie","sam"],
      tags:["Traditions","Joy"],visibility:"FAMILY_LABEL",consent:"REVIEW_NEEDED",
      status:"RECORDED",createdAt:"2026-09-20",mediaCaption:"",mediaKind:"NONE"}
  ],
  traditions:[
    {id:"trad-game",title:"Family games evening",meaning:"Protect time for laughter, play and togetherness.",
      cadence:"WEEKLY",month:1,day:1,weekday:6,householdId:"household-home",
      memberIds:["alex","jamie","sam","ella","noah"],active:true,
      moments:[{id:"trad-moment-1",date:"2026-09-19",note:"A memorable evening of board games",memoryId:"memory-laughs"}],
      createdAt:"2026-08-01"},
    {id:"trad-reflect",title:"Year-end family reflection",meaning:"Gather to share gratitude and hopes for the coming year.",
      cadence:"YEARLY",month:12,day:31,weekday:4,householdId:"household-home",
      memberIds:["alex","jamie","sam","ella","noah"],active:true,moments:[],createdAt:"2026-01-01"}
  ],
  legacy:[
    {id:"legacy-kindness",kind:"WISDOM",title:"Kindness is how we show up",
      summary:"A simple lesson the family wants to carry forward.",
      content:"Take care of each other, listen before judging and never underestimate small acts of kindness.",
      custodianId:"alex",memberIds:["alex","jamie","sam"],linkedMemoryIds:["memory-picnic"],
      visibility:"REVIEW_FIRST",status:"PRESERVED",intendedRevealDate:"",
      createdAt:"2026-09-25",updatedAt:"2026-09-25"},
    {id:"legacy-traditions",kind:"STORY",title:"Why family game night matters",
      summary:"How a simple family ritual became something everyone looks forward to.",
      content:"It started with one game and a little time together. We learned that traditions can be simple and meaningful.",
      custodianId:"jamie",memberIds:["alex","jamie","sam"],linkedMemoryIds:["memory-laughs"],
      visibility:"FAMILY_LABEL",status:"DRAFT",intendedRevealDate:"",
      createdAt:"2026-10-01",updatedAt:"2026-10-01"}
  ]
};
export function normalizeLife(raw:unknown):FamilyLifeState {
  const fresh=structuredClone(seedLife);
  if(!raw||typeof raw!=="object")return fresh;
  const value=raw as Partial<FamilyLifeState>;
  return {experiences:Array.isArray(value.experiences)?value.experiences:fresh.experiences,
    memories:Array.isArray(value.memories)?value.memories:fresh.memories,
    traditions:Array.isArray(value.traditions)?value.traditions:fresh.traditions,
    legacy:Array.isArray(value.legacy)?value.legacy:fresh.legacy};
}
export function validateExperience(record:Experience,memberIds:string[],goalIds:string[]):string|null {
  if(!record.title.trim())return "Experience needs a title.";
  if(record.date&&!validDate(record.date))return "Choose a valid date.";
  if(record.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time))return "Choose a valid time.";
  if(record.memberIds.some(id=>!memberIds.includes(id)))return "Select existing active family members.";
  if(record.linkedGoalId&&!goalIds.includes(record.linkedGoalId))return "Select an existing strategy goal.";
  return null;
}
export function validateMemory(record:Memory,memberIds:string[],life:FamilyLifeState):string|null{
  if(!record.title.trim()||!record.story.trim())return "A memory needs a title and a story.";
  if(!validDate(record.date))return "Choose a valid memory date.";
  if(record.memberIds.some(id=>!memberIds.includes(id)))return "Select existing active family members.";
  if(record.experienceId&&!life.experiences.some(e=>e.id===record.experienceId))return "Linked experience was not found.";
  if(record.traditionId&&!life.traditions.some(t=>t.id===record.traditionId))return "Linked tradition was not found.";
  if(record.status==="RECORDED"&&record.memberIds.length>0&&record.consent==="NOT_RECORDED")
    return "Record a consent-review status first, or keep this as a draft. Labels are not verified consent.";
  return null;
}
export function validateTradition(record:Tradition,memberIds:string[]):string|null{
  if(!record.title.trim()||!record.meaning.trim())return "Enter a tradition title and meaning.";
  if(record.memberIds.some(id=>!memberIds.includes(id)))return "Select existing family members.";
  if(record.cadence==="YEARLY"&&!validDate("2024-"+String(record.month).padStart(2,"0")+"-"+String(record.day).padStart(2,"0")))
    return "Select a valid month and day for a yearly tradition.";
  if(record.cadence==="MONTHLY"&&(record.day<1||record.day>31))return "Day of month must be between 1 and 31.";
  if(record.cadence==="WEEKLY"&&(record.weekday<0||record.weekday>6))return "Select a valid weekday.";
  return null;
}
export function validateLegacy(record:LegacyRecord,memberIds:string[],life:FamilyLifeState):string|null{
  if(!record.title.trim()||!record.content.trim())return "Add a legacy title and story or content.";
  if(record.custodianId&&!memberIds.includes(record.custodianId))return "Choose an existing active family custodian.";
  if(record.memberIds.some(id=>!memberIds.includes(id)))return "Select existing family members.";
  if(record.linkedMemoryIds.some(id=>!life.memories.some(m=>m.id===id)))return "Linked memory was not found.";
  if(record.intendedRevealDate&&!validDate(record.intendedRevealDate))return "Choose a valid intended date.";
  return null;
}
export function memoryFromExperience(exp:Experience,date=lifeDate()):Memory {
  return {id:freshLifeId("memory-"),title:exp.title,story:exp.summary||"",
    date:exp.date||date,experienceId:exp.id,traditionId:"",memberIds:[...exp.memberIds],tags:[experienceTypes[exp.type]],
    visibility:"REVIEW_FIRST",consent:"NOT_RECORDED",status:"DRAFT",createdAt:date,
    mediaCaption:"",mediaKind:"NONE"};
}
export function memoryFromTradition(tradition:Tradition,date=lifeDate()):Memory {
  return {id:freshLifeId("memory-"),title:tradition.title,story:"",date,experienceId:"",traditionId:tradition.id,
    memberIds:[...tradition.memberIds],tags:["Tradition"],visibility:"REVIEW_FIRST",consent:"NOT_RECORDED",
    status:"DRAFT",createdAt:date,mediaCaption:"",mediaKind:"NONE"};
}
export function legacyFromMemory(memory:Memory,date=lifeDate()):LegacyRecord {
  return {id:freshLifeId("legacy-"),kind:"STORY",title:memory.title,
    summary:"A family story inspired by a recorded memory",content:memory.story,custodianId:"",
    memberIds:[...memory.memberIds],linkedMemoryIds:[memory.id],visibility:"REVIEW_FIRST",
    status:"DRAFT",intendedRevealDate:"",createdAt:date,updatedAt:date};
}
export function recordTraditionMoment(tradition:Tradition,date:string,note:string,memoryId=""):Tradition {
  if(!validDate(date))throw new Error("A valid occurrence date is required.");
  return {...tradition,moments:[...tradition.moments,{
    id:freshLifeId("moment-"),date,note:note.trim(),memoryId
  }]};
}
export function experienceAsCalendarEvent(exp:Experience):PlanEvent {
  if(!exp.date||!validDate(exp.date)||!exp.time)throw new Error("Choose a valid date and time before adding to calendar.");
  return {id:freshLifeId("event-life-"),date:exp.date,time:exp.time,endTime:addHour(exp.time),
    title:exp.title,note:exp.summary,attendees:[...exp.memberIds],
    color:"#8baded",location:exp.location,householdId:exp.householdId,
    category:exp.type==="LEARNING"?"SCHOOL":exp.type==="TRAVEL"?"FAMILY":"FAMILY",status:"ACTIVE"};
}
function addHour(time:string):string{
  const [h,m]=time.split(":").map(Number);
  if(!Number.isInteger(h)||!Number.isInteger(m)||h<0||h>23||m<0||m>59)
    throw new Error("Choose a valid 24-hour start time.");
  const start=h*60+m;
  if(start>=1439)throw new Error("Choose a start time earlier than 23:59 for this one-day calendar preview.");
  const end=Math.min(start+60,1439);
  return String(Math.floor(end/60)).padStart(2,"0")+":"+String(end%60).padStart(2,"0");
}
export function nextTraditionDate(tradition:Tradition,from=lifeDate()):string|null{
  if(!validDate(from)||!tradition.active||tradition.cadence==="OCCASIONAL")return null;
  const y=Number(from.slice(0,4)),m=Number(from.slice(5,7));
  const tryDate=(year:number,month:number,day:number):string|null=>{
    const key=[String(year),String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-");
    return validDate(key)?key:null;
  };
  if(tradition.cadence==="YEARLY"){
    for(let i=0;i<6;i++){const d=tryDate(y+i,tradition.month,tradition.day);if(d&&d>=from)return d;}
    return null;
  }
  if(tradition.cadence==="MONTHLY"){
    for(let i=0;i<12;i++){
      const total=m-1+i,year=y+Math.floor(total/12),month=total%12+1;
      const d=tryDate(year,month,tradition.day);if(d&&d>=from)return d;
    }
    return null;
  }
  const date=new Date(from+"T12:00:00Z");
  const offset=(tradition.weekday-date.getUTCDay()+7)%7;
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}
export function sortMemories(memories:Memory[]):Memory[]{
  return [...memories].filter(m=>m.status!=="ARCHIVED").sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title));
}
export function lifeStats(life:FamilyLifeState){
  return {plannedExperiences:life.experiences.filter(e=>!e.archived&&(e.status==="PLANNED"||e.status==="IDEA")).length,
    recordedMemories:life.memories.filter(m=>m.status==="RECORDED").length,
    activeTraditions:life.traditions.filter(t=>t.active).length,
    preservedLegacy:life.legacy.filter(l=>l.status==="PRESERVED").length};
}
