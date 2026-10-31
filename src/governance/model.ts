/**
 * Family OS Phase 5 — local-only governance preview model.
 * No authentication, signatures, enforceable permissions or trusted audit log.
 * All elections, votes and approvals are local browser simulations.
 */
export type DecisionStatus = "DRAFT" | "OPEN" | "APPROVAL_PENDING" | "RESOLVED" | "DECLINED" | "CANCELLED";
export type DecisionRule = "MAJORITY" | "UNANIMOUS" | "ADVISORY";
export type DecisionCategory = "HOUSEHOLD" | "FAMILY" | "FINANCE" | "EDUCATION" | "EXPERIENCES" | "OTHER";
export type ApprovalChoice = "APPROVE" | "REJECT";
export type DecisionOption = { id:string; title:string; benefits:string; drawbacks:string };
export type Ballot = { memberId:string; optionId:string; recordedAt:string };
export type Approval = { memberId:string; choice:ApprovalChoice; recordedAt:string };
export type Decision = {
  id:string; title:string; description:string; category:DecisionCategory;
  status:DecisionStatus; rule:DecisionRule; createdAt:string; dueDate:string;
  proposerId:string; householdId:string; participantIds:string[]; requiredApproverIds:string[];
  quorum:number; options:DecisionOption[]; ballots:Ballot[]; approvals:Approval[];
  chosenOptionId:string; resolutionNote:string; linkedGoalId:string;
};
export type PolicyCategory = "COMMUNICATION"|"RESOURCES"|"SAFETY"|"PRIVACY"|"SCHEDULING"|"OTHER";
export type FamilyPolicy = {
  id:string; title:string; description:string; category:PolicyCategory;
  scope:"FAMILY"|"HOUSEHOLD"; householdId:string; kind:"GUIDELINE"|"REVIEW_REQUIRED";
  status:"ACTIVE"|"ARCHIVED"; version:number; updatedAt:string;
};
export type CharterArticle = { id:string; heading:string; body:string };
export type Constitution = {
  title:string; preamble:string; version:number; updatedAt:string; articles:CharterArticle[];
  history:{version:number; title:string; preamble:string; articles:CharterArticle[]; recordedAt:string}[];
};
export type FamilyMeeting = {
  id:string; title:string; date:string; facilitatorId:string; attendeeIds:string[];
  summary:string; nextSteps:string; decisionIds:string[]; archived:boolean;
};
export type GovernanceEvent = {
  id:string; at:string; actorId:string; action:string; subjectType:string; subjectId:string; detail:string;
};
export type GovernanceState = {
  decisions:Decision[]; policies:FamilyPolicy[]; constitution:Constitution;
  meetings:FamilyMeeting[]; activity:GovernanceEvent[];
};
export const decisionCategoryLabels:Record<DecisionCategory,string>={
  HOUSEHOLD:"Household",FAMILY:"Family wellbeing",FINANCE:"Resources & budget",
  EDUCATION:"Learning",EXPERIENCES:"Experiences",OTHER:"Other"
};
export const decisionRuleLabels:Record<DecisionRule,string>={
  MAJORITY:"Majority of ballots",UNANIMOUS:"All eligible participants",ADVISORY:"Advisory plurality"
};
export const policyCategoryLabels:Record<PolicyCategory,string>={
  COMMUNICATION:"Communication",RESOURCES:"Shared resources",SAFETY:"Family safety",
  PRIVACY:"Privacy",SCHEDULING:"Schedules & routines",OTHER:"Other"
};
const freshId=(prefix:string)=>prefix+(typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));
export {freshId};
export const seedGovernance:GovernanceState={
  decisions:[
    {id:"decision-holiday",title:"Where should we go for our next family break?",
      description:"Choose an experience everyone can enjoy while keeping the trip aligned with our family goals.",
      category:"EXPERIENCES",status:"OPEN",rule:"MAJORITY",createdAt:"2026-10-01",dueDate:"",
      proposerId:"alex",householdId:"household-home",participantIds:["alex","jamie","sam"],
      requiredApproverIds:["alex","jamie"],quorum:2,
      options:[
        {id:"holiday-nature",title:"Nature and hiking retreat",benefits:"Outdoor time and fresh air",drawbacks:"Weather dependent"},
        {id:"holiday-beach",title:"Relaxed beach getaway",benefits:"Rest and family connection",drawbacks:"More travel planning"}
      ],ballots:[],approvals:[],chosenOptionId:"",resolutionNote:"",linkedGoalId:"g1"},
    {id:"decision-game-night",title:"Pick a weekly family fun night",
      description:"Agree on a recurring evening for family time that works around school and work.",
      category:"FAMILY",status:"OPEN",rule:"ADVISORY",createdAt:"2026-10-01",dueDate:"",
      proposerId:"jamie",householdId:"household-home",participantIds:["alex","jamie","sam","ella"],
      requiredApproverIds:[],quorum:2,options:[
        {id:"fun-friday",title:"Friday evening",benefits:"Relax after the week",drawbacks:"May compete with evening plans"},
        {id:"fun-sunday",title:"Sunday afternoon",benefits:"Easy to plan at home",drawbacks:"Might conflict with outings"}
      ],ballots:[],approvals:[],chosenOptionId:"",resolutionNote:"",linkedGoalId:""}
  ],
  policies:[
    {id:"policy-listen",title:"Listen before deciding",description:"Every participating family member should have a chance to be heard. Silence is not consent.",
      category:"COMMUNICATION",scope:"FAMILY",householdId:"",kind:"GUIDELINE",status:"ACTIVE",version:1,updatedAt:""},
    {id:"policy-money",title:"Review shared major spending",description:"Major shared purchases should be openly discussed and approved by the relevant responsible adults before action.",
      category:"RESOURCES",scope:"FAMILY",householdId:"",kind:"REVIEW_REQUIRED",status:"ACTIVE",version:1,updatedAt:""},
    {id:"policy-privacy",title:"Respect personal boundaries",description:"Private personal, child and health details are never made available merely because someone coordinates the family.",
      category:"PRIVACY",scope:"FAMILY",householdId:"",kind:"GUIDELINE",status:"ACTIVE",version:1,updatedAt:""}
  ],
  constitution:{
    title:"Our Family Constitution",preamble:"We build a home where each person feels respected, safe, heard and supported.",
    version:1,updatedAt:"",history:[],
    articles:[
      {id:"article-one",heading:"Respect & belonging",body:"We listen to one another, acknowledge different needs and make room for everyone."},
      {id:"article-two",heading:"Shared responsibilities",body:"We contribute in age-appropriate ways, and make commitments manageable."},
      {id:"article-three",heading:"Privacy & consent",body:"We respect personal boundaries. Shared coordination never overrides individual privacy or safety."},
      {id:"article-four",heading:"Working through decisions",body:"We discuss options, clarify who is responsible, and review outcomes together without coercion."}
    ]
  },
  meetings:[],activity:[]
};
export function normalizeGovernance(raw:unknown):GovernanceState{
  const defaults=structuredClone(seedGovernance);
  if(!raw||typeof raw!=="object")return defaults;
  const g=raw as Partial<GovernanceState>;
  return {
    decisions:Array.isArray(g.decisions)?g.decisions:defaults.decisions,
    policies:Array.isArray(g.policies)?g.policies:defaults.policies,
    constitution:g.constitution&&typeof g.constitution==="object"?{
      ...defaults.constitution,...g.constitution,
      articles:Array.isArray(g.constitution.articles)?g.constitution.articles:defaults.constitution.articles,
      history:Array.isArray(g.constitution.history)?g.constitution.history:[]
    }:defaults.constitution,
    meetings:Array.isArray(g.meetings)?g.meetings:defaults.meetings,
    activity:Array.isArray(g.activity)?g.activity:defaults.activity
  };
}
export function eligibleParticipants(decision:Decision):string[]{
  return [...new Set(decision.participantIds.filter(Boolean))];
}
export function validDecision(decision:Decision,activeMemberIds:string[]):string|null {
  if(!decision.title.trim())return "Enter a decision title.";
  if(decision.options.length<2)return "Include at least two options.";
  if(decision.options.some(o=>!o.title.trim()))return "Every option needs a title.";
  if(new Set(decision.options.map(o=>o.id)).size!==decision.options.length)return "Option IDs must be unique.";
  if(new Set(decision.options.map(o=>o.title.trim().toLowerCase())).size!==decision.options.length)return "Option titles must be different.";
  const eligible=eligibleParticipants(decision);
  if(!eligible.length||eligible.some(id=>!activeMemberIds.includes(id)))return "Select at least one active eligible participant.";
  if(decision.participantIds.length!==eligible.length)return "A participant cannot be listed twice.";
  if(!Number.isInteger(decision.quorum)||decision.quorum<1||decision.quorum>eligible.length)return "Quorum must be between 1 and eligible participant count.";
  if(decision.requiredApproverIds.some(id=>!activeMemberIds.includes(id)))return "Choose only active family members as reviewers.";
  if(new Set(decision.requiredApproverIds).size!==decision.requiredApproverIds.length)return "A reviewer cannot be listed twice.";
  if(decision.dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(decision.dueDate))return "Invalid due date.";
  return null;
}
export function startDecision(d:Decision,activeIds:string[]):Decision {
  const problem=validDecision(d,activeIds);
  if(problem)throw new Error(problem);
  if(d.status!=="DRAFT")throw new Error("Only draft proposals can open for voting.");
  return {...d,status:"OPEN"};
}
export function castBallot(d:Decision,memberId:string,optionId:string,recordedAt:string):Decision{
  if(d.status!=="OPEN")throw new Error("Voting is not open.");
  if(!eligibleParticipants(d).includes(memberId))throw new Error("This member is not eligible to vote.");
  if(!d.options.some(o=>o.id===optionId))throw new Error("Choose an available option.");
  return {...d,ballots:[...d.ballots.filter(v=>v.memberId!==memberId),{memberId,optionId,recordedAt}]};
}
export type BallotResult={
  eligible:number;cast:number;quorum:number;quorumMet:boolean;
  totals:Record<string,number>;winnerId:string;reason:string;canClose:boolean;
};
export function tallyDecision(d:Decision):BallotResult{
  const allowed=new Set(eligibleParticipants(d)),validOptions=new Set(d.options.map(o=>o.id));
  const unique=new Map<string,string>();
  d.ballots.forEach(v=>{if(allowed.has(v.memberId)&&validOptions.has(v.optionId))unique.set(v.memberId,v.optionId);});
  const totals=Object.fromEntries(d.options.map(o=>[o.id,0])) as Record<string,number>;
  unique.forEach(id=>{totals[id]=(totals[id]||0)+1;});
  const eligible=allowed.size,cast=unique.size,quorumMet=cast>=d.quorum&&d.quorum>0;
  const sorted=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const best=sorted[0],runner=sorted[1];
  let reason="",winnerId="";
  if(!quorumMet)reason="Voting quorum has not been reached.";
  else if(!best||best[1]===0||best[1]===(runner?.[1]||0))reason="The vote is tied or has no supported option.";
  else if(d.rule==="MAJORITY"&&best[1]<=cast/2)reason="No option has a majority of ballots cast.";
  else if(d.rule==="UNANIMOUS"&&(cast!==eligible||best[1]!==eligible))
    reason="Unanimity requires every eligible participant to choose the same option.";
  else winnerId=best[0];
  return {eligible,cast,quorum:d.quorum,quorumMet,totals,winnerId,reason,canClose:!!winnerId};
}
export function closeDecisionVoting(d:Decision):Decision{
  if(d.status!=="OPEN")throw new Error("Voting is not open.");
  const result=tallyDecision(d);
  if(!result.canClose)throw new Error(result.reason);
  return {...d,chosenOptionId:result.winnerId,status:d.requiredApproverIds.length?"APPROVAL_PENDING":"RESOLVED"};
}
export function recordDecisionApproval(d:Decision,memberId:string,choice:ApprovalChoice,recordedAt:string):Decision{
  if(d.status!=="APPROVAL_PENDING")throw new Error("Decision is not awaiting review.");
  if(!d.requiredApproverIds.includes(memberId))throw new Error("This person is not a named reviewer.");
  const approvals=[...d.approvals.filter(a=>a.memberId!==memberId),{memberId,choice,recordedAt}];
  if(choice==="REJECT")return {...d,approvals,status:"DECLINED"};
  const allApproved=d.requiredApproverIds.every(id=>approvals.some(a=>a.memberId===id&&a.choice==="APPROVE"));
  return {...d,approvals,status:allApproved?"RESOLVED":"APPROVAL_PENDING"};
}
export function cancelDecision(d:Decision):Decision{
  if(d.status==="RESOLVED"||d.status==="DECLINED")throw new Error("Finalized records cannot be cancelled.");
  return {...d,status:"CANCELLED"};
}
export function reviseConstitution(current:Constitution,next:Pick<Constitution,"title"|"preamble"|"articles">,at:string):Constitution{
  if(!next.title.trim()||!next.articles.length||next.articles.some(a=>!a.heading.trim()||!a.body.trim()))
    throw new Error("A constitution needs a title and complete articles.");
  if(JSON.stringify({title:current.title,preamble:current.preamble,articles:current.articles})===JSON.stringify(next))return current;
  return {...current,title:next.title.trim(),preamble:next.preamble.trim(),articles:next.articles,
    version:current.version+1,updatedAt:at,
    history:[...current.history,{version:current.version,title:current.title,preamble:current.preamble,
      articles:structuredClone(current.articles),recordedAt:current.updatedAt||at}]};
}
export function appendGovernanceActivity(state:GovernanceState,event:Omit<GovernanceEvent,"id">):GovernanceState {
  return {...state,activity:[{...event,id:freshId("audit-")},...state.activity].slice(0,250)};
}
export function decisionNeedsInput(d:Decision):boolean{return d.status==="OPEN"||d.status==="APPROVAL_PENDING";}
export function decisionOutcomeLabel(d:Decision):string{
  return d.options.find(o=>o.id===d.chosenOptionId)?.title||"No outcome recorded";
}
