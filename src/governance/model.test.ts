import {describe,expect,it} from "vitest";
import {
  appendGovernanceActivity,cancelDecision,castBallot,closeDecisionVoting,
  decisionNeedsInput,decisionOutcomeLabel,normalizeGovernance,recordDecisionApproval,
  reviseConstitution,seedGovernance,startDecision,tallyDecision,validDecision
} from "./model";
import type {Decision} from "./model";
const members=["alex","jamie","sam","ella","noah"];
const fixture=():Decision=>structuredClone(seedGovernance.decisions[0]);
describe("Family OS decision engine",()=>{
  it("migrates old local data without sharing fixture references",()=>{
    const a=normalizeGovernance(null),b=normalizeGovernance(null);
    a.decisions[0].title="Changed locally";
    expect(b.decisions[0].title).not.toBe("Changed locally");
    expect(normalizeGovernance({decisions:[],policies:[],meetings:[],activity:[]}).decisions).toEqual([]);
  });
  it("validates participants, quorum and option integrity before opening",()=>{
    const d=fixture();
    expect(validDecision(d,members)).toBeNull();
    expect(validDecision({...d,participantIds:[]},members)).toMatch(/participant/i);
    expect(validDecision({...d,quorum:10},members)).toMatch(/quorum/i);
    expect(validDecision({...d,participantIds:["alex","alex"]},members)).toMatch(/twice/i);
    expect(validDecision({...d,options:[d.options[0]]},members)).toMatch(/two/i);
    expect(validDecision({...d,options:[d.options[0],{...d.options[1],title:d.options[0].title}]},members)).toMatch(/different/i);
    expect(()=>startDecision({...d,status:"RESOLVED"},members)).toThrow(/draft/i);
    expect(startDecision({...d,status:"DRAFT"},members).status).toBe("OPEN");
  });
  it("enforces eligible ballots and allows replacing one's own vote without duplicates",()=>{
    const d=fixture(),option=d.options[0].id;
    expect(()=>castBallot(d,"noah",option,"2026-10-31T09:00:00Z")).toThrow(/eligible/i);
    expect(()=>castBallot(d,"alex","unknown","2026-10-31T09:00:00Z")).toThrow(/option/i);
    const one=castBallot(d,"alex",option,"2026-10-31T09:00:00Z");
    const two=castBallot(one,"alex",d.options[1].id,"2026-10-31T09:15:00Z");
    expect(two.ballots).toHaveLength(1);
    expect(two.ballots[0].optionId).toBe(d.options[1].id);
    expect(d.ballots).toHaveLength(0);
  });
  it("requires quorum and a unique majority before closing",()=>{
    let d=fixture();
    d=castBallot(d,"alex",d.options[0].id,"a");
    expect(tallyDecision(d).canClose).toBe(false);
    expect(()=>closeDecisionVoting(d)).toThrow(/quorum/i);
    d=castBallot(d,"jamie",d.options[1].id,"b");
    expect(tallyDecision(d).reason).toMatch(/tied/i);
    expect(()=>closeDecisionVoting(d)).toThrow(/tied/i);
    d=castBallot(d,"jamie",d.options[0].id,"c");
    expect(tallyDecision(d).canClose).toBe(true);
    const closed=closeDecisionVoting(d);
    expect(closed.status).toBe("APPROVAL_PENDING");
    expect(closed.chosenOptionId).toBe(d.options[0].id);
    expect(decisionOutcomeLabel(closed)).toBe(d.options[0].title);
    expect(()=>castBallot(closed,"sam",d.options[0].id,"d")).toThrow(/not open/i);
  });
  it("does not confuse a plurality with majority",()=>{
    const d=fixture();
    d.options=[...d.options,{id:"third",title:"Third option",benefits:"",drawbacks:""}];
    d.ballots=[{memberId:"alex",optionId:d.options[0].id,recordedAt:"a"},
      {memberId:"jamie",optionId:d.options[1].id,recordedAt:"b"},
      {memberId:"sam",optionId:"third",recordedAt:"c"}];
    expect(tallyDecision(d).canClose).toBe(false);
    const advisory={...d,rule:"ADVISORY" as const};
    expect(tallyDecision(advisory).canClose).toBe(false); // three-way tie
    const four={...advisory,participantIds:[...advisory.participantIds,"ella"],
      ballots:[...advisory.ballots,{memberId:"ella",optionId:d.options[0].id,recordedAt:"d"}]};
    expect(tallyDecision(four).canClose).toBe(true); // 2, 1, 1 plurality
  });
  it("requires every eligible member for unanimous decisions",()=>{
    let d={...fixture(),rule:"UNANIMOUS" as const,quorum:1};
    d=castBallot(d,"alex",d.options[0].id,"a");
    expect(tallyDecision(d).canClose).toBe(false);
    d=castBallot(d,"jamie",d.options[0].id,"b");
    d=castBallot(d,"sam",d.options[0].id,"c");
    expect(tallyDecision(d).canClose).toBe(true);
  });
  it("gates outcomes on each explicit reviewer; one denial declines",()=>{
    let d=fixture();
    d=castBallot(d,"alex",d.options[0].id,"a");
    d=castBallot(d,"jamie",d.options[0].id,"b");
    d=closeDecisionVoting(d);
    expect(()=>recordDecisionApproval(d,"sam","APPROVE","c")).toThrow(/named reviewer/i);
    d=recordDecisionApproval(d,"alex","APPROVE","c");
    expect(d.status).toBe("APPROVAL_PENDING");
    const approved=recordDecisionApproval(d,"jamie","APPROVE","d");
    expect(approved.status).toBe("RESOLVED");
    expect(()=>recordDecisionApproval(approved,"alex","REJECT","e")).toThrow(/not awaiting/i);
    const declined=recordDecisionApproval(d,"jamie","REJECT","e");
    expect(declined.status).toBe("DECLINED");
  });
  it("closes directly if no reviewers; cancels drafts but not resolved outcomes",()=>{
    let d={...fixture(),requiredApproverIds:[]};
    d=castBallot(d,"alex",d.options[0].id,"a");
    d=castBallot(d,"jamie",d.options[0].id,"b");
    expect(closeDecisionVoting(d).status).toBe("RESOLVED");
    expect(cancelDecision({...d,status:"DRAFT"}).status).toBe("CANCELLED");
    expect(()=>cancelDecision(closeDecisionVoting(d))).toThrow(/finalized/i);
    expect(decisionNeedsInput({...d,status:"OPEN"})).toBe(true);
    expect(decisionNeedsInput(closeDecisionVoting(d))).toBe(false);
  });
  it("versions constitutional wording and snapshots full previous articles",()=>{
    const before=normalizeGovernance(null).constitution;
    const same=reviseConstitution(before,{title:before.title,preamble:before.preamble,articles:before.articles},"2026-10-31");
    expect(same).toBe(before);
    const after=reviseConstitution(before,{title:"Updated Charter",preamble:"Revised together",articles:[...before.articles]},
      "2026-10-31T10:00:00Z");
    expect(after.version).toBe(2);
    expect(after.history).toHaveLength(1);
    expect(after.history[0].articles).toHaveLength(4);
    after.articles[0].heading="Changed";
    expect(after.history[0].articles[0].heading).not.toBe("Changed");
    expect(()=>reviseConstitution(before,{title:"",preamble:"",articles:[]},"now")).toThrow();
  });
  it("records locally-attributed governance events without mutating the source",()=>{
    const before=normalizeGovernance(null);
    const after=appendGovernanceActivity(before,{action:"DECISION_CREATED",at:"2026-10-31",
      actorId:"alex",subjectType:"decision",subjectId:"d1",detail:"A proposal was made."});
    expect(after.activity).toHaveLength(1);
    expect(before.activity).toHaveLength(0);
    expect(after.activity[0].id).toMatch(/^audit-/);
  });
});
